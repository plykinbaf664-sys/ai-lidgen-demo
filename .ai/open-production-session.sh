#!/usr/bin/env bash
set -u

socket=/tmp/codex-leadgen-production.sock
rm -f "$socket"
clear
echo "Production VPS: единоразовая авторизация"
echo "Введите пароль root. Символы при вводе не отображаются."
echo

ssh -M -S "$socket" -o ControlPersist=3600 -o PreferredAuthentications=password -o PubkeyAuthentication=no -fN root@192.121.16.231
status=$?

if [[ $status -eq 0 ]] && ssh -S "$socket" -o BatchMode=yes root@192.121.16.231 'echo SESSION_READY'; then
  echo
  echo "SESSION_READY"
else
  echo
  echo "SESSION_FAILED"
fi

echo
read -r -p "Оставьте окно открытым и напишите в чат: готово"
