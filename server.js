const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const path = require('path');
const app = express();
const upload = multer();
const cosineSimilarity = require('compute-cosine-similarity');

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'reconocimiento'
};

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/modelos', express.static(path.join(__dirname, 'public/modelos')));

// Función para obtener una conexión a la base de datos
async function getConnection() {
    return await mysql.createConnection(dbConfig);
}

// Ruta para registrar un nuevo usuario
app.post('/registro', upload.single('imagenFacial'), async (req, res) => {
    const { nombre, password } = req.body;
    const imagenFacial = req.file ? req.file.buffer : null;
    const faceDescriptor = JSON.parse(req.body.faceDescriptor);

    try {
        const connection = await getConnection();
        const query = "INSERT INTO usuarios (nombre, password, imagen_facial, face_descriptor) VALUES (?, ?, ?, ?)";
        await connection.execute(query, [nombre, password, imagenFacial, JSON.stringify(faceDescriptor)]);
        connection.end();
        res.json({ success: true, message: 'Usuario registrado con éxito' });
    } catch (err) {
        console.error("Error al registrar usuario: ", err);
        res.status(500).json({ success: false, error: 'Error al registrar usuario' });
    }
});

// Ruta para el primer paso del login (usuario y contraseña)
app.post('/login-paso1', async (req, res) => {
    const { nombre, password } = req.body;
    
    try {
        const connection = await getConnection();
        const query = "SELECT id, face_descriptor FROM usuarios WHERE nombre = ? AND password = ?";
        const [results] = await connection.execute(query, [nombre, password]);
        connection.end();

        if (results.length > 0) {
            const { id, face_descriptor } = results[0];
            res.json({ 
                success: true, 
                userId: id, 
                faceDescriptor: face_descriptor,
                message: 'Credenciales correctas' 
            });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        }
    } catch (err) {
        console.error("Error en la consulta: ", err);
        res.status(500).json({ success: false, error: 'Error en el servidor' });
    }
});

// Ruta para el segundo paso del login (reconocimiento facial)
app.post('/login-paso2', async (req, res) => {
    const { userId, faceDescriptor } = req.body;
    
    try {
        const connection = await getConnection();
        const [user] = await connection.execute(
            "SELECT face_descriptor FROM usuarios WHERE id = ?",
            [userId]
        );
        connection.end();

        if (user.length > 0) {
            const storedDescriptor = JSON.parse(user[0].face_descriptor);
            const distance = euclideanDistance(faceDescriptor, storedDescriptor);
            const threshold = 0.6; // Ajusta según sea necesario

            if (distance < threshold) {
                res.json({ success: true, message: 'Autenticación exitosa' });
            } else {
                res.status(401).json({ success: false, message: 'Reconocimiento facial fallido' });
            }
        } else {
            res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
    } catch (err) {
        console.error("Error en la autenticación facial: ", err);
        res.status(500).json({ success: false, error: 'Error en el servidor' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
