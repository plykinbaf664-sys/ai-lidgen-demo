#!/usr/bin/env bash
set -u

clear
echo "Подключение к production VPS"
echo "Введите пароль root. При вводе символы не отображаются — это нормально."
echo

ssh-copy-id -f -i /c/Users/User/.ssh/codex_leadgen_production.pub root@192.121.16.231
status=$?

echo
if [[ $status -eq 0 ]]; then
  echo "ACCESS_INSTALLED_SUCCESSFULLY"
else
  echo "ACCESS_INSTALL_FAILED (code $status)"
fi
echo
read -r -p "Окно можно оставить открытым. Напишите в чат: готово"
