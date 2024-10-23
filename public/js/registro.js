document.addEventListener('DOMContentLoaded', async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');

    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const videoContainer = document.getElementById('video-container');
    const capturarFotoBtn = document.getElementById('capturar-foto');
    const registroForm = document.getElementById('registro-form');
    let stream;
    let capturedImage;

    capturarFotoBtn.addEventListener('click', async () => {
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
            capturedImage = { detection: resizedDetection, imageData: canvas.toDataURL('image/jpeg') };
        }
        if (stream.active) {
            requestAnimationFrame(detectFace);
        }
    }

    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!capturedImage) {
            mostrarMensaje('Por favor, capture una foto primero', 'error');
            return;
        }

        const nombre = document.getElementById('registro-name').value;
        const password = document.getElementById('registro-password').value;

        const formData = new FormData();
        formData.append('nombre', nombre);
        formData.append('password', password);
        formData.append('imagenFacial', capturedImage.imageData.split(',')[1]);
        formData.append('faceDescriptor', JSON.stringify(Array.from(capturedImage.detection.descriptor)));

        try {
            const response = await fetch('/registro', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                mostrarMensaje('Usuario registrado con éxito. Puedes iniciar sesión ahora.', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                mostrarMensaje('Error: ' + data.error, 'error');
            }
        } catch (error) {
            mostrarMensaje('Error de conexión', 'error');
        }

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        videoContainer.style.display = 'none';
    });
});

function mostrarMensaje(mensaje, tipo) {
    const mensajeElement = document.getElementById('mensaje');
    mensajeElement.textContent = mensaje;
    mensajeElement.className = tipo;
}
