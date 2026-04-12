const endpointInput = document.getElementById('endpoint')
const secretInput = document.getElementById('secret')
const saveBtn = document.getElementById('save')
const status = document.getElementById('status')

const DEFAULT_ENDPOINT = 'https://cruzar.app/api/ingest/fb-post'

chrome.storage.local.get(['endpoint', 'secret']).then((cfg) => {
  endpointInput.value = cfg.endpoint || DEFAULT_ENDPOINT
  secretInput.value = cfg.secret || ''
})

saveBtn.addEventListener('click', async () => {
  const endpoint = endpointInput.value.trim() || DEFAULT_ENDPOINT
  const secret = secretInput.value.trim()
  if (!secret) {
    status.style.color = '#ef4444'
    status.textContent = 'Secret is required'
    return
  }
  await chrome.storage.local.set({ endpoint, secret })
  status.style.color = '#10b981'
  status.textContent = '✓ Saved'
  setTimeout(() => { status.textContent = '' }, 2000)
})
