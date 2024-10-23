// Asegurarse de que faceapi esté disponible globalmente
const faceapi = window.faceapi;

async function loadScripts() {
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0');
    await loadScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2');
    
    if (typeof tf === 'undefined' || typeof faceapi === 'undefined') {
        console.error('Error al cargar las bibliotecas necesarias');
        mostrarMensaje('Error al cargar las bibliotecas necesarias', 'error');
        return;
    }

    loadFaceAPI();
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');

    const loginForm = document.getElementById('login-form');
    const startCameraButton = document.getElementById('start-camera');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    let userId = null;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('login-name').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/login-paso1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, password })
            });
            const data = await response.json();

            if (data.success) {
                userId = data.userId;
                document.getElementById('paso1').style.display = 'none';
                document.getElementById('paso2').style.display = 'block';
                mostrarMensaje('Credenciales correctas. Por favor, inicie el reconocimiento facial.', 'success');
            } else {
                mostrarMensaje(data.message || 'Error en el login', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarMensaje('Error de conexión', 'error');
        }
    });

    startCameraButton.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            video.srcObject = stream;
            video.play();
            startFaceDetection();
        } catch (error) {
            console.error('Error accediendo a la cámara:', error);
            mostrarMensaje('Error al acceder a la cámara', 'error');
        }
    });

    async function startFaceDetection() {
        const displaySize = { width: video.width, height: video.height };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawDetections(canvas, resizedDetections);

            if (detections.length > 0) {
                const faceDescriptor = detections[0].descriptor;
                await enviarFaceDescriptor(faceDescriptor);
            }
        }, 100);
    }

    async function enviarFaceDescriptor(faceDescriptor) {
        try {
            const response = await fetch('/login-paso2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, faceDescriptor: Array.from(faceDescriptor) })
            });
            const data = await response.json();

            if (data.success) {
                mostrarMensaje('Login completado con éxito', 'success');
                // Aquí puedes redirigir al usuario a la página principal o realizar otras acciones
            } else {
                mostrarMensaje(data.message || 'Error en la verificación facial', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarMensaje('Error de conexión', 'error');
        }
    }

    function mostrarMensaje(mensaje, tipo) {
        const mensajeElement = document.getElementById('mensaje');
        mensajeElement.textContent = mensaje;
        mensajeElement.className = tipo;
    }
});
