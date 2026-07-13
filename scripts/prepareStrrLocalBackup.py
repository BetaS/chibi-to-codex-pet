#!/usr/bin/env python3

from __future__ import annotations

import argparse
import ast
import gzip
import hashlib
import json
import re
import struct
import subprocess
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any


PVR_MAGIC = b"PVR\x03"
CRYPT_MAGIC = b"CRPT"
PVR_HEADER_BYTES = 52
LOCALES = ("ja", "en", "ko", "zh_hant")
SAFE_ID = set("0123456789")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Materialize an offline STRR character/edition backup "
            "from a preserved Spine archive and Karth metadata snapshot."
        )
    )
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--metadata", required=True, type=Path)
    parser.add_argument("--key-source", required=True, type=Path)
    parser.add_argument("--decoder-path", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--only-edition")
    return parser.parse_args()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def require_safe_id(value: str, label: str) -> str:
    if not value or len(value) > 16 or any(char not in SAFE_ID for char in value):
        raise ValueError(f"Unsafe {label}: {value!r}")
    return value


def load_key_table(path: Path) -> tuple[list[bytes], list[bytes]]:
    source = path.read_text("utf-8")

    def literal_list(name: str) -> Any:
        match = re.search(rf"(?m)^{name}\s*=\s*\[", source)
        if match is None:
            return None
        start = source.find("[", match.start())
        depth = 0
        for index in range(start, len(source)):
            if source[index] == "[":
                depth += 1
            elif source[index] == "]":
                depth -= 1
                if depth == 0:
                    return ast.literal_eval(source[start : index + 1])
        return None

    keys = literal_list("keys")
    ivs = literal_list("ivs")
    if not isinstance(keys, list) or not isinstance(ivs, list):
        raise ValueError("Key source does not define literal keys and ivs lists.")
    if len(keys) != len(ivs) or not keys:
        raise ValueError("Key source key/IV tables have different lengths.")
    for label, entries in (("key", keys), ("IV", ivs)):
        if any(not isinstance(entry, bytes) or len(entry) != 16 for entry in entries):
            raise ValueError(f"Key source contains an invalid AES {label} entry.")
    return keys, ivs


def decrypt_aes_block(data: bytes, key: bytes, iv: bytes) -> bytes:
    process = subprocess.run(
        [
            "openssl",
            "enc",
            "-d",
            "-aes-128-cbc",
            "-nopad",
            "-nosalt",
            "-K",
            key.hex(),
            "-iv",
            iv.hex(),
        ],
        input=data,
        capture_output=True,
        check=False,
    )
    if process.returncode != 0 or len(process.stdout) != len(data):
        message = process.stderr.decode("utf-8", errors="replace").strip()
        raise ValueError(f"OpenSSL AES decryption failed: {message}")
    return process.stdout


def decode_container(data: bytes, keys: list[bytes], ivs: list[bytes]) -> bytes:
    if len(data) >= 8 and data[-8:-4] == CRYPT_MAGIC:
        key_index = data[-3]
        if key_index >= len(keys) or len(data) < 136:
            raise ValueError(f"Invalid encrypted PVR key index: {key_index}")
        data = (
            decrypt_aes_block(data[:128], keys[key_index], ivs[key_index])
            + data[128:-8]
        )
    if data.startswith(b"\x1f\x8b"):
        data = gzip.decompress(data)
    return data


def import_decoder(path: Path):
    sys.path.insert(0, str(path))
    try:
        import texture2ddecoder  # type: ignore[import-not-found]
    except ImportError as error:
        raise RuntimeError(
            f"texture2ddecoder is unavailable under {path}"
        ) from error
    return texture2ddecoder


def decode_pvr(data: bytes, decoder: Any):
    from PIL import Image

    if len(data) < PVR_HEADER_BYTES or data[:4] != PVR_MAGIC:
        raise ValueError("Decoded texture is not a PVR v3 file.")
    pixel_format = struct.unpack_from("<Q", data, 8)[0]
    height, width, depth, surfaces, faces, mipmaps, metadata_bytes = (
        struct.unpack_from("<7I", data, 24)
    )
    if width < 1 or height < 1 or width > 4096 or height > 4096:
        raise ValueError(f"Unsafe PVR dimensions: {width}x{height}")
    if depth != 1 or surfaces != 1 or faces != 1:
        raise ValueError(
            "Only one-depth, one-surface, one-face PVR textures are supported."
        )
    texture_offset = PVR_HEADER_BYTES + metadata_bytes
    if texture_offset >= len(data):
        raise ValueError("PVR metadata extends beyond the texture file.")
    texture_data = data[texture_offset:]

    decoders = {
        0: lambda: decoder.decode_pvrtc(texture_data, width, height, True),
        1: lambda: decoder.decode_pvrtc(texture_data, width, height, True),
        2: lambda: decoder.decode_pvrtc(texture_data, width, height, False),
        3: lambda: decoder.decode_pvrtc(texture_data, width, height, False),
        6: lambda: decoder.decode_etc1(texture_data, width, height),
        7: lambda: decoder.decode_bc1(texture_data, width, height),
        11: lambda: decoder.decode_bc3(texture_data, width, height),
        22: lambda: decoder.decode_etc2(texture_data, width, height),
        23: lambda: decoder.decode_etc2a8(texture_data, width, height),
        24: lambda: decoder.decode_etc2a1(texture_data, width, height),
    }
    decode = decoders.get(pixel_format)
    if decode is None:
        raise ValueError(f"Unsupported PVR pixel format: {pixel_format}")
    pixels = decode()
    expected_bytes = width * height * 4
    if len(pixels) != expected_bytes:
        raise ValueError(
            f"Decoded pixel length mismatch: {len(pixels)} != {expected_bytes}"
        )
    image = Image.frombytes("RGBA", (width, height), pixels, "raw", "BGRA")
    return image, {
        "height": height,
        "mipmaps": mipmaps,
        "pixelFormat": pixel_format,
        "width": width,
    }


def normalize_names(value: Any, fallback: str) -> dict[str, str]:
    names: dict[str, str] = {}
    if isinstance(value, dict):
        for locale in LOCALES:
            name = value.get(locale)
            if isinstance(name, str) and name.strip():
                names[locale] = name.strip()
    if not names:
        names["en"] = fallback
    return names


def read_tar_bytes(archive: tarfile.TarFile, name: str) -> bytes:
    member = archive.getmember(name)
    if not member.isfile() or member.size <= 0:
        raise ValueError(f"Archive entry is not a non-empty regular file: {name}")
    extracted = archive.extractfile(member)
    if extracted is None:
        raise ValueError(f"Unable to read archive entry: {name}")
    return extracted.read()


def rewrite_atlas(source: bytes) -> tuple[bytes, str]:
    try:
        text = source.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise ValueError("Atlas is not valid UTF-8.") from error
    newline = "\r\n" if "\r\n" in text else "\n"
    lines = text.splitlines()
    page_index = next(
        (index for index, line in enumerate(lines) if line.strip()),
        None,
    )
    if page_index is None:
        raise ValueError("Atlas is empty.")
    source_page = lines[page_index].strip()
    if not source_page.lower().endswith(".pvr"):
        raise ValueError(f"Expected a PVR atlas page, found: {source_page}")
    lines[page_index] = str(PurePosixPath(source_page).with_suffix(".png"))
    return (newline.join(lines) + newline).encode("utf-8"), source_page


def available_archive_entries(
    archive: tarfile.TarFile,
) -> tuple[set[str], set[str]]:
    characters: set[str] = set()
    editions: set[str] = set()
    for member in archive.getmembers():
        parts = PurePosixPath(member.name).parts
        if (
            len(parts) == 4
            and parts[0:2] == ("spine", "character")
            and parts[3] == "model_right.skel"
        ):
            characters.add(require_safe_id(parts[2], "character ID"))
        if (
            len(parts) == 4
            and parts[0:2] == ("spine", "costume")
            and parts[3] == "model_right.atlas"
        ):
            editions.add(require_safe_id(parts[2], "edition ID"))
    return characters, editions


def metadata_maps(metadata: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    if not isinstance(metadata, dict) or not isinstance(metadata.get("characters"), list):
        raise ValueError("Karth normalized catalog has an invalid root.")
    characters: dict[str, Any] = {}
    editions: dict[str, Any] = {}
    for character in metadata["characters"]:
        if not isinstance(character, dict):
            continue
        character_id = require_safe_id(str(character.get("id", "")), "character ID")
        characters[character_id] = character
        for edition in character.get("editions", []):
            if not isinstance(edition, dict):
                continue
            edition_id = require_safe_id(str(edition.get("id", "")), "edition ID")
            editions[edition_id] = edition
    return characters, editions


def local_edition_names(edition_id: str) -> dict[str, str]:
    return {
        "ja": f"ローカル衣装 {edition_id}",
        "en": f"Local costume {edition_id}",
        "ko": f"로컬 의상 {edition_id}",
        "zh_hant": f"本機服裝 {edition_id}",
    }


def main() -> None:
    args = parse_args()
    if args.output.exists() and any(args.output.iterdir()):
        raise ValueError(f"Output directory is not empty: {args.output}")
    args.output.mkdir(parents=True, exist_ok=True)

    keys, ivs = load_key_table(args.key_source)
    decoder = import_decoder(args.decoder_path)
    metadata_bytes = args.metadata.read_bytes()
    metadata = json.loads(metadata_bytes.decode("utf-8"))
    metadata_characters, metadata_editions = metadata_maps(metadata)
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    conversion_records: list[dict[str, Any]] = []
    checksum_records: list[tuple[str, str]] = []

    with tarfile.open(args.archive, "r:gz") as archive:
        available_characters, available_editions = available_archive_entries(archive)
        if args.only_edition:
            only_edition = require_safe_id(args.only_edition, "edition ID")
            if only_edition not in available_editions:
                raise ValueError(f"Edition is not present in the archive: {only_edition}")
            available_editions = {only_edition}
            available_characters = {only_edition[:3]}

        valid_editions = sorted(
            (
                edition_id
                for edition_id in available_editions
                if edition_id[:3] in available_characters
            ),
            key=int,
        )
        used_character_ids = sorted(
            {edition_id[:3] for edition_id in valid_editions},
            key=int,
        )

        for character_id in used_character_ids:
            skeleton_source = (
                f"spine/character/{character_id}/model_right.skel"
            )
            skeleton_bytes = read_tar_bytes(archive, skeleton_source)
            relative_path = f"characters/{character_id}/model_right.skel"
            output_path = args.output / relative_path
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(skeleton_bytes)
            checksum_records.append((sha256_bytes(skeleton_bytes), relative_path))

        for index, edition_id in enumerate(valid_editions, start=1):
            root = f"spine/costume/{edition_id}"
            atlas_bytes = read_tar_bytes(archive, f"{root}/model_right.atlas")
            pvr_bytes = read_tar_bytes(archive, f"{root}/model_right.pvr")
            rewritten_atlas, source_page = rewrite_atlas(atlas_bytes)
            container = decode_container(pvr_bytes, keys, ivs)
            image, pvr_info = decode_pvr(container, decoder)

            edition_root = args.output / "editions" / edition_id
            edition_root.mkdir(parents=True, exist_ok=True)
            atlas_output = edition_root / "model_right.atlas"
            png_output = edition_root / "model_right.png"
            atlas_output.write_bytes(rewritten_atlas)
            image.save(png_output, format="PNG", compress_level=6)
            png_bytes = png_output.read_bytes()

            atlas_relative = f"editions/{edition_id}/model_right.atlas"
            png_relative = f"editions/{edition_id}/model_right.png"
            checksum_records.extend(
                [
                    (sha256_bytes(rewritten_atlas), atlas_relative),
                    (sha256_bytes(png_bytes), png_relative),
                ]
            )
            conversion_records.append(
                {
                    "editionId": edition_id,
                    "sourcePage": source_page,
                    "sourcePvrSha256": sha256_bytes(pvr_bytes),
                    "outputPngSha256": sha256_bytes(png_bytes),
                    **pvr_info,
                }
            )
            if index == 1 or index % 25 == 0 or index == len(valid_editions):
                print(f"Converted {index}/{len(valid_editions)} editions", flush=True)

    characters = []
    editions_by_character: dict[str, list[str]] = {}
    for edition_id in valid_editions:
        editions_by_character.setdefault(edition_id[:3], []).append(edition_id)
    for character_id in used_character_ids:
        metadata_character = metadata_characters.get(character_id, {})
        editions = []
        for edition_id in editions_by_character.get(character_id, []):
            metadata_edition = metadata_editions.get(edition_id)
            editions.append(
                {
                    "id": edition_id,
                    "labels": normalize_names(
                        metadata_edition.get("names")
                        if isinstance(metadata_edition, dict)
                        else None,
                        f"Edition {edition_id}",
                    )
                    if metadata_edition
                    else local_edition_names(edition_id),
                    "metadataSource": "karth" if metadata_edition else "local",
                    "side": "right",
                }
            )
        characters.append(
            {
                "id": character_id,
                "labels": normalize_names(
                    metadata_character.get("names")
                    if isinstance(metadata_character, dict)
                    else None,
                    f"Character {character_id}",
                ),
                "editions": editions,
            }
        )

    catalog = {
        "version": 1,
        "gameId": "strr",
        "generatedAt": generated_at,
        "characters": characters,
    }
    catalog_bytes = (json.dumps(catalog, ensure_ascii=False, indent=2) + "\n").encode(
        "utf-8"
    )
    (args.output / "catalog.json").write_bytes(catalog_bytes)
    checksum_records.append((sha256_bytes(catalog_bytes), "catalog.json"))

    manifest = {
        "version": 1,
        "generatedAt": generated_at,
        "source": {
            "assetArchiveSha256": sha256_file(args.archive),
            "metadataSha256": sha256_bytes(metadata_bytes),
            "keySourceSha256": sha256_file(args.key_source),
            "note": (
                "The key table is external input and is not copied into this backup. "
                "The application runtime does not read or serve this directory."
            ),
        },
        "counts": {
            "characters": len(characters),
            "editions": len(valid_editions),
            "karthLabeledEditions": sum(
                1 for edition_id in valid_editions if edition_id in metadata_editions
            ),
            "localOnlyEditions": sum(
                1 for edition_id in valid_editions if edition_id not in metadata_editions
            ),
        },
        "conversions": conversion_records,
    }
    manifest_bytes = (
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")
    (args.output / "manifest.json").write_bytes(manifest_bytes)
    checksum_records.append((sha256_bytes(manifest_bytes), "manifest.json"))

    checksum_records.sort(key=lambda item: item[1])
    checksum_text = "".join(
        f"{digest}  {relative_path}\n"
        for digest, relative_path in checksum_records
    )
    (args.output / "SHA256SUMS").write_text(checksum_text, "utf-8")

    print("STRR local backup complete.")
    print(f"  output: {args.output}")
    print(f"  characters: {len(characters)}")
    print(f"  editions: {len(valid_editions)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - CLI boundary
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
