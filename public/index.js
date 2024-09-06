document.getElementById('fetchUrl').addEventListener('click', getUrl);
import { nanoid } from 'https://cdn.jsdelivr.net/npm/nanoid@4.x.x/nanoid.js';

/**
 * Retrieves the original URL associated with a shortened URL from the server.
 *
 * This function is an asynchronous function that fetches the original URL from the server
 * based on the provided shortened URL. It handles the fetch request, error handling,
 * and displays a popup with the original URL or an error message.
 *
 * @param {string} shortenedUrl - The shortened URL for which the original URL needs to be retrieved.
 * @returns {Promise<void>} - A Promise that resolves when the original URL is successfully retrieved
 * and the popup is displayed, or rejects with an error message.
 */
async function getUrl() {
  const shortenedUrl = document.getElementById('shortenedUrl').value;


  try {
    const response = await fetch(`https://keys.lat/api/original-url/${shortenedUrl}`);
      if (!response.ok) {
        console.log(response);
      togglePopup(`URL No encontrada...`);
      return;
    }
    const data = await response.json();
    togglePopup(`URL Original: ${data.originalUrl}`);
  } catch (error) {
    console.log(error)
    console.log('ERROR')
    togglePopup(`Error: ${error.message}`); 
  }
}

function togglePopup(texto) {
    const popup = document.getElementById('popup');
    const popupContent = document.getElementById('popupContent')
    const overlay = document.getElementById('overlay');

    if (overlay.style.display === 'block') {
    overlay.style.display = 'none';  // Oculta el overlay
    popup.style.display = 'none';    // Oculta el popup
    popupContent.innerText = '';        // Limpia el contenido del popup
    } else {
    overlay.style.display = 'block';  // Muestra el overlay
    popup.style.display = 'block';    // Muestra el popup
    popupContent.innerText = texto;
    }
}


document.getElementById('overlay').addEventListener('click', togglePopup);
document.getElementById('closePopup').addEventListener('click', togglePopup);

document.getElementById('randomize').addEventListener('click', randomize);
function randomize(){
document.getElementById('wantedUrl').value = nanoid(5);

}


/**
 * Event listener for the form submission.
 * This function handles the form submission by preventing the default action,
 * extracting the original and wanted URL from the form data,
 * making a POST request to the '/shortUrl' endpoint,
 * and displaying a popup with the shortened URL or an error message.
 *
 * @param {Event} event - The event object representing the form submission.
 * @returns {Promise<void>}
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

        // Check if the response is in JSON format
        const result = await response.json();

        if (response.ok) {
            togglePopup(`URL Acortada: ${result.shortenedUrl}`);
        } else {
            togglePopup(`Error: ${result.error}`);
            console.log(result.error);
        }
    } catch (error) {
        togglePopup(`Error: ${error.message}`);
        console.log(error.message);
    }
});




