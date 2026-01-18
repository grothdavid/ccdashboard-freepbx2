#!/bin/bash

echo "🔍 FreePBX Python 3 Diagnostic Tool"
echo "=================================="

echo ""
echo "📋 Checking all Python executables:"
echo ""

# Check common locations
for location in /usr/bin /usr/local/bin /opt /bin; do
    if ls $location/python* 2>/dev/null; then
        echo "Found in $location:"
        ls -la $location/python*
        echo ""
    fi
done

echo "📍 PATH variable:"
echo $PATH
echo ""

echo "🔍 Searching for Python 3 anywhere on system:"
find /usr -name "python3*" 2>/dev/null | head -10
echo ""

echo "🧪 Testing different Python commands:"
echo ""

# Test various python commands
for cmd in python python3 python3.9 python3.8 python3.7 /usr/bin/python3 /usr/local/bin/python3; do
    if command -v "$cmd" &> /dev/null; then
        version=$($cmd --version 2>&1)
        echo "✅ $cmd: $version"
        
        # Check if it's Python 3
        if echo "$version" | grep -q "Python 3"; then
            echo "   🎯 This is Python 3! Use: $cmd"
        fi
    else
        echo "❌ $cmd: not found"
    fi
done

echo ""
echo "🔧 If Python 3 exists but wasn't found, try these manual commands:"
echo ""
echo "# Test if any python3 works:"
echo "python3 --version"
echo "/usr/bin/python3 --version"
echo ""
echo "# If you find a working Python 3, use it directly:"
echo "# Replace YOUR_PYTHON3_PATH with the actual path"
echo "YOUR_PYTHON3_PATH -m pip install --user aiohttp mysql-connector-python"
echo ""
echo "# Then create the service manually with that path"