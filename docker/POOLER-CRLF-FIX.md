# supabase-pooler падает: инструкция для ИИ

## Проблема
Контейнер **supabase-pooler** (Supavisor) постоянно перезапускается.

## Как убедиться
```bash
docker ps -a   # статус Restarting у supabase-pooler
docker logs supabase-pooler --tail 80
```
В логах: **SyntaxError** в Elixir, `unexpected token: carriage return (code point U+000D)` на строке 30 в `nofile` (это файл pooler.exs).

## Причина
Файл **`docker/supabase-repo/docker/volumes/pooler/pooler.exs`** имеет окончания строк **CRLF** (Windows). В Linux-контейнере Elixir парсит этот файл; символ `\r` (U+000D) для парсера недопустим — процесс падает.

## Решение
1. Перевести **pooler.exs** на переводы строк **LF** (без `\r`).  
   Либо: заменить в файле все `\r\n` на `\n` и сохранить.  
   Либо: в редакторе выбрать Line Ending = LF и сохранить.
2. В корне проекта в **`.gitattributes`** добавить (или проверить наличие):  
   `docker/supabase-repo/docker/volumes/pooler/pooler.exs text eol=lf`
3. Выполнить: `docker restart supabase-pooler`  
   Ожидаемый статус: `Up (healthy)`.

## Если после этого pooler всё ещё падает
- Проверить `.env`: подставить сгенерированные **SECRET_KEY_BASE** и **VAULT_ENC_KEY** (скрипт `docker/supabase-repo/docker/utils/generate-keys.sh`).
- Проверить занятость порта 5432 на хосте; при необходимости сменить **POSTGRES_PORT** в `.env`.
- В docker-compose для сервиса **supavisor** задать `healthcheck.start_period: 40s`.

Подробнее: `docker/README.md`, раздел 4.
