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
#   2. если менялся js/links.js, проверяет, что в нём нет опечатки (из-за неё ломается страница «Проекты»),
#      и по желанию проверяет, что все ссылки на игры открываются;
#   3. спрашивает, что написать в описании изменения (оно будет видно в истории на GitHub);
#   4. добавляет все изменения, делает коммит от вашего имени и отправляет его на GitHub;
#   5. GitHub Pages сам обновляет сайт через минуту-две.
#
# Файлы из .gitignore (например, папка texturs) никогда не отправляются.

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

# ---------- что изменилось ----------
$changes = @(& git -c core.quotepath=false status --porcelain -uall)
if ($changes.Count -eq 0) {
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
& git push origin $Branch
if ($LASTEXITCODE -ne 0) {
    Stop-Here ("Не получилось отправить на GitHub. Изменения уже сохранены в коммите $hash на вашем компьютере, ничего не потеряно.`n" +
               "Возможные причины: нет интернета; не выполнен вход в GitHub; на GitHub есть изменения, которых нет у вас.`n" +
               "В последнем случае выполните  git pull --rebase origin $Branch  и снова запустите скрипт.")
}

Say ''
Say "Готово! Коммит $hash отправлен." 'Green'
Say "Сайт обновится через минуту-две: $SiteUrl  (если видите старую версию, нажмите Ctrl+F5)" 'Green'
