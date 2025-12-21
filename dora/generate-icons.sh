#!/bin/bash

# Script to generate Tauri icons from SVG logo
# Requires: ImageMagick (convert), rsvg-convert, or inkscape

SVG_FILE="src-tauri/icons/logo.svg"
ICONS_DIR="src-tauri/icons"

# Colors for status
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Generating icons for Dora...${NC}"

# Check if SVG exists
if [ ! -f "$SVG_FILE" ]; then
    echo -e "${YELLOW}Error: SVG file not found at $SVG_FILE${NC}"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Try different tools in order of preference
if command_exists rsvg-convert; then
    CONVERT_CMD="rsvg-convert"
    CONVERT_ARGS="-w"
elif command_exists inkscape; then
    CONVERT_CMD="inkscape"
    CONVERT_ARGS="--export-width"
elif command_exists convert; then
    CONVERT_CMD="convert"
    CONVERT_ARGS="-resize"
else
    echo -e "${YELLOW}Error: No suitable image conversion tool found.${NC}"
    echo "Please install one of: rsvg-convert, inkscape, or ImageMagick (convert)"
    exit 1
fi

convert_icon() {
    local size=$1
    local output="$ICONS_DIR/${size}x${size}.png"
    
    if [ "$CONVERT_CMD" = "rsvg-convert" ]; then
        rsvg-convert -w "$size" -h "$size" "$SVG_FILE" -o "$output"
    elif [ "$CONVERT_CMD" = "inkscape" ]; then
        inkscape "$SVG_FILE" --export-width="$size" --export-height="$size" --export-filename="$output"
    elif [ "$CONVERT_CMD" = "convert" ]; then
        convert -background none -resize "${size}x${size}" "$SVG_FILE" "$output"
    fi
    
    if [ -f "$output" ]; then
        echo -e "${GREEN}✓${NC} Generated ${size}x${size}.png"
    else
        echo -e "${YELLOW}✗${NC} Failed to generate ${size}x${size}.png"
    fi
}

# Generate standard PNG icons
echo "Generating PNG icons..."
convert_icon 32
convert_icon 64
convert_icon 128
convert_icon 256

# Generate 2x retina version
convert_icon 256
mv "$ICONS_DIR/256x256.png" "$ICONS_DIR/128x128@2x.png"
echo -e "${GREEN}✓${NC} Generated 128x128@2x.png (from 256x256)"

# Generate icon.png (512x512 for general use)
convert_icon 512
mv "$ICONS_DIR/512x512.png" "$ICONS_DIR/icon.png"
echo -e "${GREEN}✓${NC} Generated icon.png (from 512x512)"

# Generate .ico for Windows (requires ImageMagick or special tool)
if command_exists convert; then
    echo "Generating Windows .ico file..."
    convert "$ICONS_DIR/icon.png" -define icon:auto-resize=256,128,64,48,32,16 "$ICONS_DIR/icon.ico"
    if [ -f "$ICONS_DIR/icon.ico" ]; then
        echo -e "${GREEN}✓${NC} Generated icon.ico"
    fi
fi

# Generate .icns for macOS (requires iconutil or special tool)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if command_exists iconutil; then
        echo "Generating macOS .icns file..."
        mkdir -p "$ICONS_DIR/icon.iconset"
        
        # Create all required sizes for .icns
        for size in 16 32 64 128 256 512; do
            if [ "$size" -eq 16 ] || [ "$size" -eq 32 ]; then
                # Generate 1x and 2x versions
                convert_icon "$size"
                convert_icon "$((size * 2))"
            else
                convert_icon "$size"
            fi
        done
        
        # Copy to iconset with proper naming (simplified - full implementation would require more steps)
        echo -e "${YELLOW}Note:${NC} For full .icns generation, use:"
        echo "  iconutil -c icns icon.iconset"
    fi
fi

echo -e "\n${GREEN}Icon generation complete!${NC}"
echo -e "${YELLOW}Note:${NC} You may need to manually generate .icns and .ico files using:"
echo "  - macOS: iconutil or online converters"
echo "  - Windows: Use an online converter or ImageMagick"




