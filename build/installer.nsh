; Custom "Additional Tasks" page — desktop shortcut checkbox
; 只在安装程序构建中生效，卸载程序构建跳过
!ifndef BUILD_UNINSTALLER

!include "nsDialogs.nsh"

Var createDesktopShortcutEnabled
Var hCheckbox

!macro customPageAfterChangeDir
  PageEx custom
    PageCallbacks additionalTasks_Create additionalTasks_Leave
    Caption " "
  PageExEnd
!macroend

Function additionalTasks_Create
  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0u 10u 100% 20u "请选择要执行的附加任务："
  Pop $0

  ${NSD_CreateCheckBox} 0u 36u 100% 12u "创建桌面快捷方式(&D)"
  Pop $hCheckbox
  ${NSD_SetState} $hCheckbox ${BST_CHECKED}

  nsDialogs::Show
FunctionEnd

Function additionalTasks_Leave
  ${NSD_GetState} $hCheckbox $0
  StrCpy $createDesktopShortcutEnabled $0
FunctionEnd

!macro customInstall
  ; 如果用户取消勾选，删除已创建的桌面快捷方式
  ${if} $createDesktopShortcutEnabled != ""
  ${andif} $createDesktopShortcutEnabled != ${BST_CHECKED}
    Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  ${endif}
!macroend

!endif
