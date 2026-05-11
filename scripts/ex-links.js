'use strict'

document.addEventListener('DOMContentLoaded', () => {
  console.log('Here is index.html')
  if (window.electronAPI && window.electronAPI.versions) {
    console.log('Chrome version:', window.electronAPI.versions.chrome)
    console.log('Electron version:', window.electronAPI.versions.electron)
  }

  const links = document.querySelectorAll('a[href]')
  links.forEach((link) => {
    const url = link.getAttribute('href')
    if (url && url.indexOf('http') === 0) {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        window.electronAPI.openExternal(url)
      })
    }
  })
})
