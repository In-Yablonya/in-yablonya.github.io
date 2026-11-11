# Отправка изменений сайта на GitHub: одна команда вместо git add / commit / push.
#
# Как запустить:
#   - дважды щёлкните по publish.bat в папке сайта, или
#   - откройте PowerShell в папке сайта и выполните:   .\publish.ps1
#   - чтобы только посмотреть, что будет сделано, ничего не отправляя:   .\publish.ps1 -DryRun
#   - чтобы не отвечать на вопрос про описание:   .\publish.ps1 -Message "Обновлены ссылки на игры"
#
# Что делает:
#   1. показывает, какие файлы изменились;
#   2. проверяет, что среди них нет секретов (файлов с паролями и ключами, закрытых ключей, токенов);
#   3. если менялся js/links.js, проверяет, что в нём нет опечатки (из-за неё ломается страница «Проекты»),
#      и по желанию проверяет, что все ссылки на игры открываются;
#   4. спрашивает, что написать в описании изменения (оно будет видно в истории на GitHub);
#   5. добавляет все изменения, делает коммит от вашего имени и отправляет его на GitHub;
#   6. если на GitHub есть чужие изменения (например, файл, загруженный через сайт GitHub), предлагает подтянуть их;
#   7. GitHub Pages сам обновляет сайт через минуту-две.
#
# Файлы из .gitignore (папка texturs, ключи, пароли, журналы) никогда не отправляются.

param(
    [switch]$DryRun,        # только показать, что будет сделано
    [string]$Message = ''   # описание изменения (если не указано, скрипт спросит)
)

# ---------- настройки: от чьего имени делается коммит ----------
$AuthorName  = 'svetlyi072-debug'
$AuthorEmail = '293587133+svetlyi072-debug@users.noreply.github.com'   # служебный адрес GitHub: настоящая почта нигде не показывается
$Branch      = 'main'                                                  # из этой ветки GitHub Pages собирает сайт
$SiteUrl     = 'https://in-yablonya.github.io/'
$MaxFileMB   = 50                                                      # файлы крупнее не отправляем: GitHub не принимает больше 100 МБ
# ----------------------------------------------------------------

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }   # чтобы русский текст и имена файлов не превращались в кракозябры
Set-Location -LiteralPath $PSScriptRoot

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }

function Stop-Here($text) {
    Write-Host ''
    Write-Host $text -ForegroundColor Red
    exit 1
}

function Confirm-Yes($question, [bool]$defaultYes) {
    $hint = if ($defaultYes) { '[Y/n]' } else { '[y/N]' }
    $answer = "$(Read-Host "$question $hint")".Trim()
    if (-not $answer) { return $defaultYes }
    return ($answer -match '^(y|yes|д|да)$')
}

# git с русскими именами файлов «как есть»; при ошибке скрипт останавливается
function Invoke-Git {
    & git -c core.quotepath=false @args
    if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') завершился с ошибкой (код $LASTEXITCODE)" }
}

# Отправка на GitHub. Если GitHub отклонил её, потому что там есть изменения, которых нет у вас
# (например, файл, загруженный через сайт GitHub), предлагает подтянуть их и повторяет отправку.
function Push-Site {
    & git push origin $Branch
    if ($LASTEXITCODE -eq 0) { return $true }

    & git fetch origin --quiet
    $incoming = @(& git -c core.quotepath=false diff --name-status "HEAD...origin/$Branch")
    if ($incoming.Count -eq 0) { return $false }   # причина другая: нет интернета или не выполнен вход

    Say ''
    Say 'На GitHub есть изменения, которых нет на вашем компьютере. Они касаются файлов:' 'Yellow'
    $incoming | ForEach-Object { Write-Host "  $_" }
    if (-not (Confirm-Yes 'Подтянуть их и повторить отправку? Ваши изменения при этом сохранятся.' $true)) { return $false }

    & git -c core.quotepath=false pull --rebase origin $Branch
    if ($LASTEXITCODE -ne 0) {
        & git rebase --abort
        Stop-Here ('Не получилось объединить изменения автоматически (кто-то правил те же строки). Я отменил объединение: ваши изменения целы, они сохранены в последнем коммите.' + "`n" +
                   'Объединить их нужно вручную, попросите помощи.')
    }
    & git push origin $Branch
    return ($LASTEXITCODE -eq 0)
}

# ---------- проверки перед началом ----------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Stop-Here 'Не найден git. Установите его с https://git-scm.com/ и запустите скрипт снова.'
}
if (-not (Test-Path -LiteralPath '.git')) {
    Stop-Here 'Эта папка не похожа на репозиторий сайта (нет папки .git). Положите publish.ps1 в папку сайта.'
}
$current = (& git branch --show-current) -join ''
if ($current -ne $Branch) {
    Stop-Here "Сейчас выбрана ветка «$current», а сайт публикуется из «$Branch». Переключитесь командой:  git checkout $Branch"
}

# узнаём, что сейчас на GitHub (нужно, чтобы понять, есть ли неотправленные коммиты)
& git fetch origin --quiet
if ($LASTEXITCODE -ne 0) { Say 'Нет связи с GitHub: проверьте интернет. Отправка может не получиться.' 'Yellow' }
$ahead = 0
$aheadText = (& git rev-list --count "origin/$Branch..HEAD") -join ''
if ($aheadText -match '^\d+$') { $ahead = [int]$aheadText }

# ---------- что изменилось ----------
$changes = @(& git -c core.quotepath=false status --porcelain -uall)
if ($changes.Count -eq 0) {
    if ($ahead -gt 0) {
        # новых правок нет, но раньше сохранённые коммиты не дошли до GitHub (например, отправка не удалась)
        Say "Новых изменений нет, но на компьютере есть сохранённые коммиты, которых ещё нет на GitHub ($ahead):" 'Yellow'
        & git -c core.quotepath=false log --format='  %h  %s' "origin/$Branch..HEAD"
        if ($DryRun) { Say 'Режим -DryRun: ничего не отправляю.' 'Yellow'; exit 0 }
        if (-not (Confirm-Yes 'Отправить их на сайт?' $true)) { Say 'Отменено, ничего не отправлено.' 'Yellow'; exit 0 }
        Say ''
        Say 'Отправляю на GitHub…' 'Cyan'
        if (-not (Push-Site)) {
            Stop-Here 'Не получилось отправить на GitHub. Коммиты сохранены на вашем компьютере, ничего не потеряно. Проверьте интернет и вход в GitHub, затем запустите скрипт снова.'
        }
        Say ''
        Say 'Готово! Отправлено.' 'Green'
        Say "Сайт обновится через минуту-две: $SiteUrl  (если видите старую версию, нажмите Ctrl+F5)" 'Green'
        exit 0
    }
    Say 'Нечего отправлять: изменений нет.' 'Yellow'
    exit 0
}

$files = @()
Say ''
Say "Изменённые файлы ($($changes.Count)):" 'Cyan'
foreach ($line in $changes) {
    $code = $line.Substring(0, 2).Trim()
    $file = $line.Substring(3)
    if ($file -match ' -> ') { $file = ($file -split ' -> ')[-1] }
    $file = $file.Trim('"')
    $files += $file
    $label = if ($code -eq '??' -or $code -eq 'A') { 'новый' } elseif ($code -match 'D') { 'удалён' } elseif ($code -match 'R') { 'переименован' } else { 'изменён' }
    Write-Host ('  {0,-12} {1}' -f $label, $file)
}

# слишком крупные файлы (например, случайно скопированная игра) GitHub не примет
$big = @($files | Where-Object { (Test-Path -LiteralPath $_ -PathType Leaf) -and ((Get-Item -LiteralPath $_).Length -gt ($MaxFileMB * 1MB)) })
if ($big.Count -gt 0) {
    Stop-Here ("Слишком крупные файлы (больше $MaxFileMB МБ): " + ($big -join ', ') + "`nИгры выкладывайте в Releases их репозиториев, а не на сайт. Уберите файлы из папки сайта и запустите скрипт снова.")
}

# ---------- защита от секретов ----------
# Имена файлов и строки внутри, которые выглядят как пароли и ключи. Ключ Firebase из js/firebase-config.js сюда
# не входит: он публичный по устройству, его защищают правила базы.
$secretNames = '(^|/)\.env(\.|$)', '\.(pem|key|p12|pfx|jks|keystore)$', '(^|/)id_(rsa|ed25519)', 'service.?account.*\.json$',
               'credentials.*\.json$', 'secrets?.*\.json$', 'firebase-debug.*\.log$', '(^|/)\.claude/settings\.local\.json$'
$secretText  = '-----BEGIN [A-Z ]*PRIVATE KEY-----', 'gh[pousr]_[A-Za-z0-9]{30,}', 'github_pat_[A-Za-z0-9_]{30,}', 'AKIA[0-9A-Z]{16}',
               'xox[baprs]-[A-Za-z0-9-]{10,}', '"private_key"\s*:', '"type"\s*:\s*"service_account"', 'client_secret'
$textExt     = '.js', '.json', '.html', '.css', '.md', '.txt', '.bat', '.yml', '.yaml', '.xml', '.svg', '.cfg', '.ini', '.env'
$suspects = @()
foreach ($f in $files) {
    $name = $f -replace '\\', '/'
    if ($name -eq 'publish.ps1' -or $name -eq '.gitignore') { continue }     # здесь эти шаблоны перечислены сами
    if (@($secretNames | Where-Object { $name -match $_ }).Count -gt 0) { $suspects += "$f  (имя файла похоже на секретный)"; continue }
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { continue }
    $item = Get-Item -LiteralPath $f
    if ($item.Length -gt 1MB -or ($textExt -notcontains $item.Extension.ToLower())) { continue }
    $hit = Select-String -LiteralPath $f -Pattern $secretText -List -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hit) { $suspects += "$f  (строка $($hit.LineNumber): похоже на ключ, токен или пароль)" }
}
if ($suspects.Count -gt 0) {
    Say ''
    Say 'ВНИМАНИЕ: похоже, среди файлов есть секретные. На GitHub сайт публичный, их увидит любой:' 'Red'
    $suspects | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Say 'Если файл не должен попадать на GitHub, добавьте его имя в .gitignore (или удалите из папки сайта).' 'Yellow'
    if (-not (Confirm-Yes 'Отправить всё равно?' $false)) {
        Say 'Отменено, ничего не отправлено.' 'Yellow'
        exit 0
    }
}

# ---------- проверка ссылок на игры ----------
if ($files -contains 'js/links.js') {
    Say ''
    if (Get-Command node -ErrorAction SilentlyContinue) {
        & node --check 'js/links.js'
        if ($LASTEXITCODE -ne 0) {
            Stop-Here 'В js/links.js опечатка (чаще всего потерялась запятая или кавычка), страница «Проекты» из-за неё пустая. Исправьте файл и запустите скрипт снова. Ничего не отправлено.'
        }
        Say 'js/links.js: синтаксис в порядке.' 'Green'
        if (Confirm-Yes 'Проверить, что все ссылки на игры открываются? Это займёт до минуты.' $false) {
            & node '.claude/check-links.js'
            if ($LASTEXITCODE -ne 0) {
                if (-not (Confirm-Yes 'Есть ссылки со знаком ✗ (они не открываются). Всё равно отправить?' $false)) {
                    Say 'Отменено, ничего не отправлено.' 'Yellow'
                    exit 0
                }
            }
        }
    } else {
        Say 'Node.js не найден, поэтому проверку js/links.js пропускаю.' 'Yellow'
    }
}

# ---------- описание изменения ----------
$default = 'Обновление сайта'
if ($files.Count -eq 1 -and $files[0] -eq 'js/links.js') { $default = 'Обновлены ссылки на игры' }
Say ''
$message = $Message.Trim()
if (-not $message) { $message = "$(Read-Host "Что написать в описании изменения? Enter — «$default»")".Trim() }
if (-not $message) { $message = $default }

Say ''
if ($ahead -gt 0) { Say "Вместе с ним уйдут и ранее сохранённые, но не отправленные коммиты: $ahead." 'Yellow' }
Say "Коммит будет от имени: $AuthorName" 'Gray'
Say "Описание:             $message" 'Gray'
if ($DryRun) {
    Say ''
    Say 'Режим -DryRun: ничего не добавлено, не сохранено и не отправлено.' 'Yellow'
    exit 0
}
if (-not (Confirm-Yes 'Отправить на сайт?' $true)) {
    Say 'Отменено, ничего не отправлено.' 'Yellow'
    exit 0
}

# ---------- коммит и отправка ----------
Invoke-Git add -A

# описание передаём через файл: так кавычки и русские буквы доходят до git без искажений
$messageFile = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($messageFile, $message + "`n", (New-Object System.Text.UTF8Encoding($false)))
    Invoke-Git -c "user.name=$AuthorName" -c "user.email=$AuthorEmail" commit -q -F $messageFile
} finally {
    Remove-Item -LiteralPath $messageFile -ErrorAction SilentlyContinue
}
$hash = (& git rev-parse --short HEAD) -join ''

Say ''
Say 'Отправляю на GitHub…' 'Cyan'
if (-not (Push-Site)) {
    Stop-Here ("Не получилось отправить на GitHub. Изменения уже сохранены в коммите $hash на вашем компьютере, ничего не потеряно.`n" +
               "Возможные причины: нет интернета; не выполнен вход в GitHub. Исправьте это и снова запустите скрипт: он отправит сохранённый коммит.")
}
$hash = (& git rev-parse --short HEAD) -join ''

Say ''
Say "Готово! Коммит $hash отправлен." 'Green'
Say "Сайт обновится через минуту-две: $SiteUrl  (если видите старую версию, нажмите Ctrl+F5)" 'Green'
