import json

# 1. zh.ts - add i18n keys
with open('src/i18n/zh.ts', 'r', encoding='utf-8') as f:
    zh = f.read()
zh = zh.replace(
    "reminderGroup: '组',\n  reminderAnd: '且',",
    "reminderGroup: '组',\n  reminderBoolVar: '变量',\n  reminderBool: 'Boolean',\n  reminderUnitS: '秒',\n  reminderUnitM: '分',\n  reminderUnitH: '时',\n  reminderConfirm: '确定',\n  reminderAnd: '且',"
)
# Fix page title
zh = zh.replace("reminderPageTitle: '提醒规则',", "reminderPageTitle: '提醒',")
with open('src/i18n/zh.ts', 'w', encoding='utf-8') as f:
    f.write(zh)

# 2. en.ts
with open('src/i18n/en.ts', 'r', encoding='utf-8') as f:
    en = f.read()
en = en.replace(
    "reminderGroup: 'Group',\n  reminderAnd: 'AND',",
    "reminderGroup: 'Group',\n  reminderBoolVar: 'Variable',\n  reminderBool: 'Boolean',\n  reminderUnitS: 's',\n  reminderUnitM: 'm',\n  reminderUnitH: 'h',\n  reminderConfirm: 'OK',\n  reminderAnd: 'AND',"
)
en = en.replace("reminderPageTitle: 'Reminder Rules',", "reminderPageTitle: 'Reminders',")
with open('src/i18n/en.ts', 'w', encoding='utf-8') as f:
    f.write(en)

# 3. types.ts - add i18n fields
with open('src/i18n/types.ts', 'r', encoding='utf-8') as f:
    typ = f.read()
typ = typ.replace(
    "reminderGroup: string;\n  reminderAnd: string;",
    "reminderGroup: string;\n  reminderBoolVar: string;\n  reminderBool: string;\n  reminderUnitS: string;\n  reminderUnitM: string;\n  reminderUnitH: string;\n  reminderConfirm: string;\n  reminderAnd: string;"
)
with open('src/i18n/types.ts', 'w', encoding='utf-8') as f:
    f.write(typ)

print('i18n done')
