# Narración en español con una voz local de Windows (sin servicios externos).
# Genera public/voice/<id>.wav. Para cambiar la voz: $voice = 'Microsoft Sabina Desktop' (u otra de GetInstalledVoices()).
Add-Type -AssemblyName System.Speech

$lines = [ordered]@{
  'v1' = '¿Quieres ganar veinte mil pesos?'
  'v2' = 'Entra a Friendegle entre las veintidós y las veintitrés horas. ¡Todos los días a esa hora hay un concurso nuevo!'
  'v3' = 'Busca al usuario con el cartel.'
  'v4' = 'Ingresa el código único...'
  'v5' = '¡Y gana el premio!'
  'v6' = 'Entra a Friendegle con el link en la bio o en los comentarios.'
}
$voice = 'Microsoft Sabina Desktop'
$rate = '+12%' # un poco más rápido: ritmo de TikTok

$outDir = Join-Path $PSScriptRoot '..\public\voice'
New-Item -ItemType Directory -Force $outDir | Out-Null
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

foreach ($id in $lines.Keys) {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.SelectVoice($voice)
  $file = Join-Path $outDir "$id.wav"
  $synth.SetOutputToWaveFile($file, $format)
  $text = [System.Security.SecurityElement]::Escape($lines[$id])
  $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-MX'><prosody rate='$rate' pitch='+5%'>$text</prosody></speak>"
  $synth.SpeakSsml($ssml)
  $synth.Dispose()
  Write-Output "voz $id -> $file"
}
