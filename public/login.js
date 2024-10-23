document.addEventListener('DOMContentLoaded', async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');

    const loginForm = document.getElementById('login-form');
    const startCameraButton = document.getElementById('start-camera');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const videoContainer = document.getElementById('video-container');
    let userId = null;
    let stream;

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
            stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            video.srcObject = stream;
            videoContainer.style.display = 'block';
            await video.play();
            requestAnimationFrame(detectFace);
        } catch (error) {
            console.error('Error accediendo a la cámara:', error);
            mostrarMensaje('Error al acceder a la cámara', 'error');
        }
    });

    async function detectFace() {
        const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
        if (detection) {
            const displaySize = { width: video.width, height: video.height };
            const resizedDetection = faceapi.resizeResults(detection, displaySize);
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawDetections(canvas, [resizedDetection]);
            await enviarFaceDescriptor(resizedDetection.descriptor);
        }
        if (stream.active) {
            requestAnimationFrame(detectFace);
        }
    }

    async function enviarFaceDescriptor(faceDescriptor) {
        try {
            console.log('Enviando descriptor facial:', faceDescriptor);
            const response = await fetch('/login-paso2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, faceDescriptor: Array.from(faceDescriptor) })
            });
            const data = await response.json();
            console.log('Respuesta del servidor:', data);

            if (data.success) {
                mostrarMensaje('Login completado con éxito', 'success');
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                videoContainer.style.display = 'none';
                // Aquí puedes redirigir al usuario a la página principal o realizar otras acciones
            } else {
                mostrarMensaje(data.message || 'Error en la verificación facial', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarMensaje('Error de conexión', 'error');
        }
    }
});

function mostrarMensaje(mensaje, tipo) {
    const mensajeElement = document.getElementById('mensaje');
    mensajeElement.textContent = mensaje;
    mensajeElement.className = tipo;
}
