#!/bin/bash
# 构建前预处理 www 目录
# 1. 把原始保存的网页文件转换为标准结构
# 2. 重命名 .下载 后缀的文件
# 3. 修改 HTML 内部路径引用
# 4. 注入原生桥接脚本
# 5. 移除外部字体引用（离线可用）

set -e
WWW_DIR="www"

echo "=== 准备 www 目录 ==="

# 找到原始 HTML 文件（非 index.html）
HTML_FILE=$(find "$WWW_DIR" -maxdepth 1 -name "*.html" ! -name "index.html" | head -1)
if [ -z "$HTML_FILE" ]; then
    echo "未找到原始 HTML 文件，检查是否已有 index.html"
    if [ -f "$WWW_DIR/index.html" ]; then
        echo "index.html 已存在，跳过预处理"
        exit 0
    fi
    echo "错误：没有找到任何 HTML 文件"
    exit 1
fi

echo "找到 HTML: $HTML_FILE"

# 找到 _files 文件夹
FILES_DIR=$(find "$WWW_DIR" -maxdepth 1 -type d -name "*_files" | head -1)
if [ -z "$FILES_DIR" ]; then
    echo "错误：未找到 _files 文件夹"
    exit 1
fi

echo "找到资源文件夹: $FILES_DIR"

# 1. 重命名 _files 为 assets
ASSETS_DIR="$WWW_DIR/assets"
if [ -d "$ASSETS_DIR" ]; then
    rm -rf "$ASSETS_DIR"
fi
cp -r "$FILES_DIR" "$ASSETS_DIR"

# 2. 重命名 .下载 后缀的文件
echo "重命名 .下载 文件..."
find "$ASSETS_DIR" -name "*.下载" | while read -r file; do
    new_name="${file%.下载}"
    mv "$file" "$new_name"
    echo "  重命名: $(basename "$file") -> $(basename "$new_name")"
done

# 3. 获取旧文件夹名用于替换
OLD_DIR_NAME=$(basename "$FILES_DIR")

# 4. 读取并修改 HTML
echo "处理 HTML 文件..."

# 备份原始文件名用于读取
cp "$HTML_FILE" "$HTML_FILE.bak"

# 用 sed 替换路径
# 替换旧文件夹名为 assets
sed -i "s|${OLD_DIR_NAME}|assets|g" "$HTML_FILE.bak"
# 去掉 .下载 后缀
sed -i 's/\.下载//g' "$HTML_FILE.bak"

# 5. 移除 @font-face 中引用外部字体的块（离线时不需要）
echo "移除外部字体引用..."
perl -i -0pe 's/\@font-face\s*\{[^}]*fonts\.gstatic\.com[^}]*\}//gs' "$HTML_FILE.bak"
perl -i -0pe 's/\@font-face\s*\{[^}]*fonts\.googleapis\.com[^}]*\}//gs' "$HTML_FILE.bak"
# 移除 style 标签中仅剩的 @font-face 空块
perl -i -0pe 's/<style[^>]*>\s*<\/style>//gs' "$HTML_FILE.bak"

# 6. 注入桥接脚本（在 </head> 前插入）
if ! grep -q "native-bridge.js" "$HTML_FILE.bak"; then
    sed -i 's|</head>|    <script src="./native-bridge.js"></script>\n</head>|' "$HTML_FILE.bak"
    echo "已注入原生桥接脚本"
fi

# 7. 保存为 index.html
mv "$HTML_FILE.bak" "$WWW_DIR/index.html"

# 8. 删除原始 HTML
rm -f "$HTML_FILE"

echo ""
echo "=== 预处理完成 ==="
echo "index.html 大小: $(wc -c < "$WWW_DIR/index.html") 字节"
echo "assets 文件数: $(find "$ASSETS_DIR" -type f | wc -l)"
echo ""
echo "assets 目录内容:"
ls -la "$ASSETS_DIR/"
