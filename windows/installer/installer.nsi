; PDF 展台 Windows 安装程序（NSIS 3）
; 编译：makensis -DARCH=x64 -DAPP_SRC=<打包目录> -DOUTFILE=<输出 exe> installer.nsi
Unicode true

!define APP_NAME "PDF 展台"
!define APP_FILE "PDFStage.exe"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "PDF Stage"
!define APP_URL "https://gailv748.github.io/pdf-stage/"
!define APP_REG "Software\PDFStage"
!define APP_DATA_DIR "PDF展台"

!ifndef ARCH
  !define ARCH "x64"
!endif
!ifndef APP_SRC
  !error "APP_SRC 未定义"
!endif
!ifndef OUTFILE
  !define OUTFILE "PDFStage-Setup-${APP_VERSION}-${ARCH}.exe"
!endif

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUTFILE}"
!if "${ARCH}" == "x64"
  InstallDir "$PROGRAMFILES64\${APP_NAME}"
!else
  InstallDir "$PROGRAMFILES\${APP_NAME}"
!endif
InstallDirRegKey HKLM "${APP_REG}" "InstallDir"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
SetCompressorDictSize 32
CRCCheck on

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} 安装程序"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "LegalCopyright" "MIT License"

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"

; ---------- 品牌外观 ----------
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "sidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "sidebar.bmp"
!define MUI_FINISHPAGE_NOREBOOTSUPPORT
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_FILE}"
!define MUI_FINISHPAGE_RUN_TEXT "立即运行 PDF 展台"
!define MUI_FINISHPAGE_SHOWREADME "${APP_URL}"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "打开官网查看使用说明"
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!define MUI_WELCOMEPAGE_TITLE "欢迎安装 ${APP_NAME} ${APP_VERSION}"
!define MUI_WELCOMEPAGE_TEXT "PDF 展台是一款为课堂演示而生的 PDF 阅读器：横竖屏都完整显示，图标不会被裁切；批注可以画到页面外的空白处；橡皮擦到哪就擦到哪。$\r$\n$\r$\n128 页横屏文档照样秒开，翻页跟手，支持双页对比与一键导出带批注的 PDF。$\r$\n$\r$\n点击「下一步」继续，安装过程约需 1 分钟。"
!define MUI_DIRECTORYPAGE_TEXT_TOP "请选择 ${APP_NAME} 的安装位置。如需安装到其他文件夹，点击「浏览」；点击「安装」开始复制文件。"
!insertmacro MUI_PAGE_WELCOME

Page custom OptionsPage OptionsLeave
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_TITLE "安装完成"
!define MUI_FINISHPAGE_TEXT "${APP_NAME} ${APP_VERSION} 已安装到：$\r$\n$INSTDIR$\r$\n$\r$\n桌面与开始菜单已创建快捷方式，随时可以卸载。"
!insertmacro MUI_PAGE_FINISH

!define MUI_UNWELCOMEPAGE_TITLE "卸载 ${APP_NAME}"
!define MUI_UNWELCOMEPAGE_TEXT "卸载程序将移除 ${APP_NAME} ${APP_VERSION} 及其快捷方式。$\r$\n$\r$\n阅读记录与批注数据默认保留，卸载完成后会再询问一次。"
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"
BrandingText "${APP_NAME} · 本地处理，不上传文件"

Var ChkDesktop
Var ChkStartMenu
Var ChkStartup

Function .onInit
  !if "${ARCH}" == "x64"
    ${IfNot} ${RunningX64}
      MessageBox MB_OK|MB_ICONSTOP "此安装包为 64 位版本，请在 64 位 Windows 上安装。$\r$\n32 位系统请下载 x86 版本安装包。"
      Abort
    ${EndIf}
    SetRegView 64
  !else
    SetRegView 32
  !endif
FunctionEnd

; ---------- 安装选项 ----------
Function OptionsPage
  !insertmacro MUI_HEADER_TEXT "安装选项" "选择安装完成后要创建的内容"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0u 100% 22u "安装程序会复制主程序文件，并添加卸载信息。以下快捷方式可以按需勾选："
  Pop $1

  ${NSD_CreateCheckBox} 0 34u 100% 12u "创建桌面快捷方式"
  Pop $ChkDesktop
  ${NSD_Check} $ChkDesktop

  ${NSD_CreateCheckBox} 0 52u 100% 12u "添加到开始菜单"
  Pop $ChkStartMenu
  ${NSD_Check} $ChkStartMenu

  ${NSD_CreateCheckBox} 0 70u 100% 12u "开机自动启动（课堂电脑常用）"
  Pop $ChkStartup

  ${NSD_CreateHLine} 0 92u 100% 1u
  Pop $2

  ${NSD_CreateLabel} 0 102u 100% 40u "安装包内已包含运行所需的全部组件，无需额外下载；文件全部保存在本地，批注与阅读进度也不会离开这台电脑。"
  Pop $3

  nsDialogs::Show
FunctionEnd

Function OptionsLeave
FunctionEnd

; ---------- 安装 ----------
Function KillOld
  nsExec::Exec 'taskkill /F /IM ${APP_FILE}'
  Pop $0
FunctionEnd

Section "主程序" SEC_MAIN
  Call KillOld

  ; 覆盖安装时先跑旧版卸载程序
  IfFileExists "$INSTDIR\Uninstall.exe" 0 no_old
    ExecWait '"$INSTDIR\Uninstall.exe" /S _?=$INSTDIR'
  no_old:

  SetOutPath "$INSTDIR"
  File /r "${APP_SRC}\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "快捷方式" SEC_LINK
  ${If} $ChkDesktop == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_FILE}" "" "$INSTDIR\${APP_FILE}" 0
  ${EndIf}
  ${If} $ChkStartMenu == ${BST_CHECKED}
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_FILE}" "" "$INSTDIR\${APP_FILE}" 0
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe"
  ${EndIf}
  ${If} $ChkStartup == ${BST_CHECKED}
    CreateShortCut "$SMSTARTUP\${APP_NAME}.lnk" "$INSTDIR\${APP_FILE}"
  ${Else}
    Delete "$SMSTARTUP\${APP_NAME}.lnk"
  ${EndIf}
SectionEnd

Section "注册信息" SEC_REG
  WriteRegStr HKLM "${APP_REG}" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "${APP_REG}" "Version" "${APP_VERSION}"

  !define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "${UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKLM "${UNINST_KEY}" "URLInfoAbout" "${APP_URL}"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_FILE}"
  WriteRegStr HKLM "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoRepair" 1

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

; ---------- 卸载 ----------
Function un.onInit
  !if "${ARCH}" == "x64"
    SetRegView 64
  !else
    SetRegView 32
  !endif
FunctionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMSTARTUP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"

  RMDir /r "$INSTDIR"

  DeleteRegKey HKLM "${UNINST_KEY}"
  DeleteRegKey HKLM "${APP_REG}"

  MessageBox MB_YESNO|MB_ICONQUESTION "是否同时删除阅读记录与批注数据？$\r$\n选择「否」将保留，下次安装后仍可继续使用。" /SD IDNO IDNO keep_data
    RMDir /r "$APPDATA\${APP_DATA_DIR}"
    RMDir /r "$LOCALAPPDATA\${APP_DATA_DIR}"
  keep_data:
SectionEnd
