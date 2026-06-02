; Custom "Additional Tasks" page — desktop shortcut checkbox

Var createDesktopShortcutEnabled

!macro customPageAfterChangeDir
  !insertmacro MUI_HEADER_TEXT "$(chooseInstallationOptions)" "请选择要执行的附加任务"

  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateCheckBox} 0u 20u 100% 12u "创建桌面快捷方式(&D)"
  Pop $1
  ${NSD_SetState} $1 ${BST_CHECKED}

  nsDialogs::Show

  ${NSD_GetState} $1 $0
  StrCpy $createDesktopShortcutEnabled $0
!macroend

!macro customInstall
  ; 如果用户取消勾选，删除已创建的桌面快捷方式
  ${if} $createDesktopShortcutEnabled != ""
  ${andif} $createDesktopShortcutEnabled != ${BST_CHECKED}
    Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  ${endif}
!macroend
