## PDF 展台 v1.0

仿希沃视频展台操作手感的 PDF 阅读器，同一套前端打包为 Windows / macOS / Linux / Android。

### 本次更新
- **Windows 安装包**：新增 NSIS 安装程序（x64 / x86），品牌化安装向导（深色侧栏 + 页眉），可选桌面快捷方式、开始菜单、开机自启，带控制面板卸载项，覆盖安装会先静默卸载旧版。原绿色版继续提供。
- **批注可画到页面外**：输入层覆盖整个窗格，页边空白同样可以落笔，笔画按 PDF 坐标保存，缩放后位置不变。
- **橡皮跟随图标**：按下出现圆形橡皮，擦除范围就是图标经过的位置，命中的笔画按分段裁剪，不会整条误删。
- **右滑清空全部批注**：点橡皮后按钮上方出现「向右滑动擦除所有批注」，清空可撤销。
- **横竖屏自适应**：平板竖屏时工具条自动换行，图标不再被裁切；翻页器与缩放条动态让位。
- **像图片一样左右滑动翻页**，右下角为希沃白板同款翻页控件。
- **性能**：128 页 16:9 横屏文档约 1.2 秒打开，连续翻页约 20ms/页，缩略图按可视区懒加载。
- 双页对比、导出带批注的 PDF、本地持久化。

### 下载

| 平台 | 文件 |
| --- | --- |
| Windows x64 安装包（Win 10 / 11，推荐） | `PDFStage-Setup-1.0.0-x64.exe`（68 MB） |
| Windows x86 安装包（Win 7 / 8 / 8.1，推荐） | `PDFStage-Setup-1.0.0-x86.exe`（65 MB） |
| Windows 绿色版 | `PDFStage-Windows-x64-portable.zip` / `PDFStage-Windows-x86-portable.zip` |
| macOS Apple Silicon（M1–M4） | `PDFStage-macOS-AppleSilicon.zip` |
| macOS Intel | `PDFStage-macOS-Intel.zip` |
| Linux x64 | `PDFStage-Linux-x64-portable.tar.gz` |
| Android 通用（arm64 + x86） | `PDFStage-Android-universal-v1.0.apk` |
| 128 页横屏测试文档 | `PDFStage-Test-128pages.pdf` |

### 校验与提示

- Android 安装包 2 178 906 字节，`sha256 = e27e5b2746a41968105c74bbfcfef82b76557c879c4915eae03c04ce98ae2127`；若大小明显不符说明下载被截断（此前「解析包时出现问题」即由此引起）。minSdk 21 / targetSdk 34，v1+v2+v3 签名。
- Windows 安装包为 NSIS 3 生成的 32 位安装器（x64 版内置 64 位主程序），支持 Win7 及以上；系统若拦截，请选择「仍要运行」。
- macOS 应用未签名，首次请右键 →「打开」，或 `xattr -cr "/Applications/PDF 展台.app"`。
- Linux 解压后运行 `启动.sh`；个别发行版如提示沙箱错误，可加 `--no-sandbox`。

官网与 4K60 宣传片：https://gailv748.github.io/pdf-stage/
