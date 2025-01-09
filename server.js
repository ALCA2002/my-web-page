const express = require('express'); // Import Express
const path = require('path'); // Import Path module
const bodyParser = require('body-parser'); // Import body-parser
const session = require('express-session'); // Import express-session
var mysql = require('mysql'); //Connects to mysql
const bcrypt = require('bcrypt'); // Import bcrypt

const app = express(); // Create an Express application
const PORT = 3000; // Define the port number


// database connection
var con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'recipesharing'
});

con.connect(function(err) {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connection successful');
});

// Middleware to parse URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files from the 'public' folder
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true })); // Set up session management


// Middleware to check if a user is logged in
function isLoggedIn(req, res, next) {
    if (req.session && req.session.userId) {
        return next(); // User is logged in, proceed to the next middleware
    }
    res.redirect('/login'); 
}

// Main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html')); 
});


//------------------------------

// Login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html')); 
});


// Handle login submission
app.post('/login', (req, res) => {
    const { username, password } = req.body; // Get data from the form
    const existingUserQuery = 'SELECT * FROM users WHERE username = ?';
    
    con.query(existingUserQuery, [username], async (err, results) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).send('Server error');
        }
        if (results.length > 0) {
            const user = results[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.userId = user.username; // Store username in session
                res.redirect('/recipes'); 
            } else {
                res.send('Invalid credentials! <a href="/login">Try again</a>'); 
            }
        } else {
            res.send('Invalid credentials! <a href="/login">Try again</a>'); 
        }
    });
});


//--------------------------

// Registration page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html')); 
});

// Handle registration submission
app.post('/register', async (req, res) => {
    const { username, password } = req.body; // Get data from the form
    const existingUserQuery = 'SELECT * FROM users WHERE username = ?';
    
    con.query(existingUserQuery, [username], async (err, results) => {
        if (err) {
            console.error('Error checking for existing user:', err);
            return res.status(500).send('Server error');
        }
        if (results.length > 0) {
            return res.send('User  already exists! <a href="/register">Try again</a>'); 
        }
        
        try {
            
            // Hash the password before saving it to the database
            const hashedPassword = await bcrypt.hash(password, 10);
            const insertUserQuery = 'INSERT INTO users (username, password) VALUES (?, ?)';
            con.query(insertUserQuery, [username, hashedPassword], (err) => {
                if (err) {
                    console.error('Error inserting new user:', err);
                    return res.status(500).send('Server error');
                }
                res.redirect('/login'); 
            });
        } catch (hashError) {
            console.error('Error hashing password:', hashError);
            return res.status(500).send('Server error');
        }
    });
});


//-------------------------

// Add recipe page
app.get('/add-recipe', isLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'add-recipe.html')); 
});

// Handle recipe submission
app.post('/add-recipe', isLoggedIn, (req, res) => {
    const { title, ingredients, instructions, category } = req.body; // Get data from the form
    const user = req.session.userId; // Get the logged-in user

    const insertRecipeQuery = 'INSERT INTO recipes (title, ingredients, instructions, category, user) VALUES (?, ?, ?, ?, ?)';
    
    con.query(insertRecipeQuery, [title, ingredients, instructions, category, user], (err) => {
        if (err) {
            console.error('Error inserting recipe:', err);
            return res.status(500).send('Server error');
        }
        res.redirect('/recipes'); 
    });
});


//---------------------------

// Recipes page
app.get('/recipes', isLoggedIn, (req, res) => {
    const searchQuery = req.query.search || ''; // Get the search query from the URL
    const filteredRecipesQuery = `
        SELECT * FROM recipes 
        WHERE title LIKE ? OR ingredients LIKE ? OR category LIKE ?
    `;
    
    const searchTerm = `%${searchQuery}%`;

    con.query(filteredRecipesQuery, [searchTerm, searchTerm, searchTerm], (err, results) => {
        if (err) {
            console.error('Error retrieving recipes:', err);
            return res.status(500).send('Server error');
        }

        // Recipe Response HTML
        res.send(`
            <p style="font-size: 3em; text-align: center; font-family: 'Courier New', Courier, monospace;">All Recipes</p>

            <form action="/recipes" method="GET" style="text-align: center;">
                <input type="text" name="search" placeholder="Search Recipe..." value="${searchQuery}" style="padding: 20px; width: 300px; border-radius: 5px; border: 1px solid #ccc;">
                <button type="submit" style="padding: 10px; border: none; background-color: grey; color: white; border-radius: 5px; cursor: pointer;">Search</button>
            </form>

            <ul>
            ${results.length > 0 ? 
                results.map(recipe => `<li><strong>${recipe.title}</strong>: ${recipe.ingredients} - ${recipe.instructions} (${recipe.category}) by ${recipe.user}</li>`).join('') 
                : '<li>No recipes found.</li>'}
            </ul>

            <hr style="width: 1500px;">
            <div class="container" style="background: transparent; color: black; text-align: center; font-family: 'Courier New', Courier, monospace;">
                <a href="/add-recipe" style="color: black;">Add Recipe</a>
                <a href="/logout" style="color: black;">Logout</a>
            </div>
            <hr style="width: 1500px;">
        `); // Show all recipes
    });
});

// Handle logout
app.get('/logout', (req, res) => {
    req.session.userId = null; 
    res.redirect('/'); // Redirect to the main page
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`); 
});