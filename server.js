const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const path = require('path');
const app = express();
const upload = multer();
const cosineSimilarity = require('compute-cosine-similarity');
const bcrypt = require('bcrypt');

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

// Middleware para registrar todas las solicitudes
app.use((req, res, next) => {
    console.log(`Solicitud recibida: ${req.method} ${req.url}`);
    next();
});

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
        const hashedPassword = await bcrypt.hash(password, 10); // Hash de la contraseña
        const connection = await getConnection();
        const query = "INSERT INTO usuarios (nombre, password, imagen_facial, face_descriptor) VALUES (?, ?, ?, ?)";
        await connection.execute(query, [nombre, hashedPassword, imagenFacial, JSON.stringify(faceDescriptor)]);
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
        const query = "SELECT id, password, face_descriptor FROM usuarios WHERE nombre = ?";
        const [results] = await connection.execute(query, [nombre]);
        connection.end();

        if (results.length > 0) {
            const { id, password: hashedPassword, face_descriptor } = results[0];
            const passwordMatch = await bcrypt.compare(password, hashedPassword);

            if (passwordMatch) {
                res.json({ 
                    success: true, 
                    userId: id, 
                    faceDescriptor: face_descriptor,
                    message: 'Credenciales correctas' 
                });
            } else {
                res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
            }
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
    console.log('Procesando /login-paso2');
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
            const threshold = 0.4; // Cambia este valor según sea necesario sirve para la distancia entre los descriptores

            console.log('Distancia calculada:', distance); // Log para verificar

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

// Función para calcular la distancia euclidiana
function euclideanDistance(descriptor1, descriptor2) {
    if (descriptor1.length !== descriptor2.length) {
        throw new Error('Los descriptores deben tener la misma longitud');
    }
    return Math.sqrt(descriptor1.reduce((sum, val, i) => sum + Math.pow(val - descriptor2[i], 2), 0));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
