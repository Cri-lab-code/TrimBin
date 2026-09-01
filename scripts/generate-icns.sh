#!/bin/bash
set -e

echo "Searching for source PNG icon..."
SRC_ICON=""

# Cerca l'icona sorgente nei percorsi standard
for path in "icon.png" "build/icon.png" "assets/icon.png" "frontend/public/icon.png" "frontend/src/assets/icon.png" "public/icon.png"; do
  if [ -f "$path" ]; then
    SRC_ICON="$path"
    break
  fi
done

if [ -z "$SRC_ICON" ]; then
  SRC_ICON=$(find . -maxdepth 4 -name "*icon*.png" ! -path "*/node_modules/*" ! -path "*/dist/*" | head -n 1)
fi

if [ -z "$SRC_ICON" ]; then
  echo "Error: No icon.png file found in codebase."
  exit 1
fi

echo "Found source icon: $SRC_ICON"

mkdir -p build
cp "$SRC_ICON" build/icon.png

ICONSET_DIR="build/TrimBin.iconset"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

echo "Generating mipmaps for macOS..."
sips -z 16 16     "$SRC_ICON" --out "$ICONSET_DIR/icon_16x16.png" > /dev/null 2>&1
sips -z 32 32     "$SRC_ICON" --out "$ICONSET_DIR/icon_16x16@2x.png" > /dev/null 2>&1
sips -z 32 32     "$SRC_ICON" --out "$ICONSET_DIR/icon_32x32.png" > /dev/null 2>&1
sips -z 64 64     "$SRC_ICON" --out "$ICONSET_DIR/icon_32x32@2x.png" > /dev/null 2>&1
sips -z 128 128   "$SRC_ICON" --out "$ICONSET_DIR/icon_128x128.png" > /dev/null 2>&1
sips -z 256 256   "$SRC_ICON" --out "$ICONSET_DIR/icon_128x128@2x.png" > /dev/null 2>&1
sips -z 256 256   "$SRC_ICON" --out "$ICONSET_DIR/icon_256x256.png" > /dev/null 2>&1
sips -z 512 512   "$SRC_ICON" --out "$ICONSET_DIR/icon_256x256@2x.png" > /dev/null 2>&1
sips -z 512 512   "$SRC_ICON" --out "$ICONSET_DIR/icon_512x512.png" > /dev/null 2>&1
sips -z 1024 1024 "$SRC_ICON" --out "$ICONSET_DIR/icon_512x512@2x.png" > /dev/null 2>&1

echo "Compiling native icon.icns..."
iconutil -c icns "$ICONSET_DIR" -o build/icon.icns
cp build/icon.icns icon.icns

rm -rf "$ICONSET_DIR"

echo "Native icon.icns generated successfully."
