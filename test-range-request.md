# WebDAV MCP服务器 - 范围请求功能演示

这个文件用于测试新的范围请求功能，该功能模拟HTTP 206 Partial Content响应。

## 功能概述

新增的 `webdav_range_request` 工具允许您：

1. **读取文件的特定字节范围** - 类似于HTTP范围请求
2. **支持多种范围格式**：
   - `bytes=0-499` - 前500字节
   - `bytes=500-` - 从第500字节到文件末尾
   - `0-499` - 简化格式，等同于 `bytes=0-499`

3. **获取详细的响应信息**：
   - Content-Range头信息
   - Accept-Ranges支持状态
   - 实际返回的内容长度
   - 文件总大小

## 使用场景

- **大文件分块读取** - 逐段处理大型文件
- **断点续传模拟** - 模拟下载管理器的续传功能
- **内容预览** - 只读取文件开头部分进行预览
- **流式数据处理** - 按需处理文件的不同部分

## 示例用法

```
// 读取文件的前100个字节
webdav_range_request(path="/test.txt", range="bytes=0-99")

// 从第1000字节开始读取到文件末尾
webdav_range_request(path="/large-file.txt", range="bytes=1000-")

// 读取特定范围的内容
webdav_range_request(path="/data.json", range="bytes=500-1499")
```

## 技术实现

该功能使用WebDAV库的 `createReadStream` 方法，支持：

- 高效的流式读取
- 精确的字节范围控制
- 内存友好的大文件处理
- 完整的错误处理和日志记录

现在让我们测试一下这个功能...
