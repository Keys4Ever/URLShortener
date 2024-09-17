import { nanoid } from 'https://cdn.jsdelivr.net/npm/nanoid@4.x.x/nanoid.js';

/**
 * Retrieves the original URL associated with a shortened URL from the server.
 */
async function getUrl() {
  const shortenedUrl = document.getElementById('shortenedUrl').value;

  try {
    const response = await fetch(`https://keys.lat/api/original-url/${shortenedUrl}`);
    if (!response.ok) {
      const errorData = await response.json();
      togglePopup(`URL No encontrada: ${errorData.message}`);
      return;
    }

    const data = await response.json(); // Obtener la respuesta como JSON
    const originalUrl = data.originalUrl; // Acceder a la propiedad correcta
    togglePopup(`URL Original: ${originalUrl}`);
  } catch (error) {
    togglePopup(`Error: ${error.message}`);
    console.log(error);
  }
}

function togglePopup(texto) {
  const popup = document.getElementById('popup');
  const popupContent = document.getElementById('popupContent');
  const overlay = document.getElementById('overlay');

  if (overlay.style.display === 'block') {
    overlay.style.display = 'none';  // Oculta el overlay
    popup.style.display = 'none';    // Oculta el popup
    popupContent.innerText = '';     // Limpia el contenido del popup
  } else {
    overlay.style.display = 'block'; // Muestra el overlay
    popup.style.display = 'block';   // Muestra el popup
    popupContent.innerText = texto;
  }
}

document.getElementById('overlay').addEventListener('click', togglePopup);
document.getElementById('closePopup').addEventListener('click', togglePopup);

document.getElementById('randomize').addEventListener('click', randomize);
function randomize() {
  document.getElementById('wantedUrl').value = nanoid(5);
}

/**
 * Event listener for the form submission.
 */
document.querySelector('form').addEventListener('submit', async function (event) {
  event.preventDefault();

  const formData = new FormData(this);
  const originalUrl = formData.get('originalUrl');
  const wantedUrl = formData.get('wantedUrl');

  try {
    const response = await fetch('/shortUrl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        originalUrl,
        wantedUrl
      })
    });

    const result = await response.json();

    if (response.ok) {
      // Redirigir a la página de éxito con el ID de la URL acortada
      window.location.href = `/public/successful.html?urlId=${result.id}`;
    } else {
      // Si hay un error, mostrarlo en el popup
      togglePopup(`Error: La url deseada ya se encuentra en uso`);
      console.log(result.error);
    }
  } catch (error) {
    togglePopup(`Error: ${error.message}`);
    console.log(error.message);
  }
});
