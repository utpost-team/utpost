<script setup lang="ts">
import { ref } from 'vue'
import type { ApiError, PhotoUploadRequest, PhotoUploadResponse } from '@utpost/shared'
import { post } from '@/api'

// M7 steg 3: uppladdningsflödet. Bytes lämnar inte browsern den här veckan – browsern läser
// bara ut måtten och skickar { tourId, filename, width, height }. API:et sparar raden och
// låter funktionen process-image räkna fram varianterna.
const props = defineProps<{ tourId: number }>()

const result = ref<PhotoUploadResponse | null>(null)
const error = ref('')
const uploading = ref(false)

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  result.value = null
  error.value = ''
  uploading.value = true
  try {
    const bitmap = await createImageBitmap(file)
    const body: PhotoUploadRequest = {
      tourId: props.tourId,
      filename: file.name,
      width: bitmap.width,
      height: bitmap.height,
    }
    bitmap.close()

    const res = await post<PhotoUploadResponse | ApiError>('/photos', body)
    if ('error' in res) {
      // 502 från API:et: funktionen svarade inte (eller nyckeln var fel i molnet).
      error.value = `Bilden kunde inte bearbetas just nu (${res.error}). Försök igen om en stund.`
    } else {
      result.value = res
    }
  } catch {
    // Ingen bild (createImageBitmap) eller inget JSON-svar (t.ex. proxyns egen 502-sida).
    error.value = 'Kunde inte ladda upp bilden. Är det en bildfil, och är API:et igång?'
  } finally {
    uploading.value = false
    input.value = ''
  }
}
</script>

<template>
  <section class="photo-upload">
    <h2>Ladda upp bild</h2>
    <label for="photo-file">Välj en bild</label>
    <input id="photo-file" type="file" accept="image/*" :disabled="uploading" @change="onFile" />

    <p v-if="uploading">Bearbetar...</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>

    <div v-if="result" class="result">
      <p>
        <strong>{{ result.filename }}</strong> · {{ result.width }}×{{ result.height }}
        <span v-if="result.coldStart" class="cold">Kallstart</span>
      </p>
      <p class="muted">
        Funktionen: {{ result.processingMs }} ms · API:et totalt: {{ result.apiMs }} ms · instans
        {{ result.instance }}
      </p>
      <ul class="variants">
        <li v-for="v in result.variants" :key="v.size">
          {{ v.size }} px · <code>{{ v.signature }}</code>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.photo-upload {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.error {
  color: #e53e3e;
}

.cold {
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 0.25rem;
  background: #2b6cb0;
  color: #fff;
  font-size: 0.85em;
}
</style>
