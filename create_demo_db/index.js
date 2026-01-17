const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../demo.sqlite');

// Delete existing file if present
if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    // 1. Location History
    db.run(`CREATE TABLE IF NOT EXISTS location_history (
        id INTEGER PRIMARY KEY, 
        lat REAL, 
        lng REAL, 
        time TEXT
    )`);

    const stmtLocation = db.prepare("INSERT INTO location_history (lat, lng, time) VALUES (?, ?, ?)");
    const baseLat = 37.7749;
    const baseLng = -122.4194;
    for (let i = 0; i < 100; i++) {
        const lat = baseLat + (Math.random() - 0.5) * 0.1;
        const lng = baseLng + (Math.random() - 0.5) * 0.1;
        const time = new Date(Date.now() - i * 3600000).toISOString();
        stmtLocation.run(lat, lng, time);
    }
    stmtLocation.finalize();

    // 2. Health Data
    // Weight
    db.run(`CREATE TABLE IF NOT EXISTS weight (id INTEGER PRIMARY KEY, value REAL, time TEXT)`);
    const stmtWeight = db.prepare("INSERT INTO weight (value, time) VALUES (?, ?)");
    let weight = 70.0;
    for (let i = 0; i < 30; i++) {
        weight += (Math.random() - 0.5) * 1.0;
        const time = new Date(Date.now() - i * 86400000).toISOString();
        stmtWeight.run(weight, time);
    }
    stmtWeight.finalize();

    // Sleep
    db.run(`CREATE TABLE IF NOT EXISTS sleep (id INTEGER PRIMARY KEY, value REAL, time TEXT)`);
    const stmtSleep = db.prepare("INSERT INTO sleep (value, time) VALUES (?, ?)");
    for (let i = 0; i < 30; i++) {
        const hours = 6.0 + Math.random() * 3.0;
        const time = new Date(Date.now() - i * 86400000).toISOString();
        stmtSleep.run(hours, time);
    }
    stmtSleep.finalize();

    // Steps
    db.run(`CREATE TABLE IF NOT EXISTS steps (id INTEGER PRIMARY KEY, value INTEGER, time TEXT)`);
    const stmtSteps = db.prepare("INSERT INTO steps (value, time) VALUES (?, ?)");
    for (let i = 0; i < 30; i++) {
        const steps = Math.floor(4000 + Math.random() * 10000);
        const time = new Date(Date.now() - i * 86400000).toISOString();
        stmtSteps.run(steps, time);
    }
    stmtSteps.finalize();

    // 3. Finance Data
    db.run(`CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, name TEXT, balance REAL, type TEXT)`);
    const stmtAccounts = db.prepare("INSERT INTO accounts (name, balance, type) VALUES (?, ?, ?)");
    const accounts = [
        ["Checking", 5432.10, "checking"],
        ["Savings", 12000.50, "savings"],
        ["401k", 85000.00, "retirement"],
        ["Crypto Wallet", 3200.00, "sellable_asset"]
    ];
    accounts.forEach(acc => stmtAccounts.run(acc));
    stmtAccounts.finalize();

    db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, amount REAL, account_id INTEGER)`);
    const stmtTrans = db.prepare("INSERT INTO transactions (date, description, amount, account_id) VALUES (?, ?, ?, ?)");
    const descriptions = ["Grocery Store", "Gas Station", "Salary", "Restaurant", "Utility Bill", "Online Purchase"];
    for (let i = 0; i < 50; i++) {
        const desc = descriptions[Math.floor(Math.random() * descriptions.length)];
        let amount = (Math.random() * 200) - 100;
        if (desc === "Salary") amount = 3000;
        const date = new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000).toISOString();
        const accId = Math.floor(Math.random() * 4) + 1;
        stmtTrans.run(date, desc, amount, accId);
    }
    stmtTrans.finalize();

    // 4. Energy Data
    db.run(`CREATE TABLE IF NOT EXISTS electricity (id INTEGER PRIMARY KEY, time TEXT, solar REAL, consumption REAL, import REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS gas (id INTEGER PRIMARY KEY, time TEXT, import REAL)`);
    const stmtElec = db.prepare("INSERT INTO electricity (time, solar, consumption, import) VALUES (?, ?, ?, ?)");
    const stmtGas = db.prepare("INSERT INTO gas (time, import) VALUES (?, ?)");

    for (let i = 0; i < 24 * 7; i++) {
        const time = new Date(Date.now() - i * 3600000).toISOString();
        const hour = new Date(time).getHours();
        const solar = (hour >= 6 && hour <= 18) ? Math.random() * 5 : 0;
        const consumption = 0.5 + Math.random() * 2;
        const elecImport = Math.max(0, consumption - solar);
        const gasImport = Math.random() * 3;

        stmtElec.run(time, solar, consumption, elecImport);
        stmtGas.run(time, gasImport);
    }
    stmtElec.finalize();
    stmtGas.finalize();

    // 5. Movies
    db.run(`CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY, title TEXT, year INTEGER, rating INTEGER, time_watched TEXT, poster_url TEXT)`);
    const stmtMovies = db.prepare("INSERT INTO movies (title, year, rating, time_watched, poster_url) VALUES (?, ?, ?, ?, ?)");
    const moviesList = [
        ["Inception", 2010, 5, "https://image.tmdb.org/t/p/w200/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg"],
        ["The Matrix", 1999, 5, "https://image.tmdb.org/t/p/w200/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"],
        ["Interstellar", 2014, 4, "https://image.tmdb.org/t/p/w200/gEU2QniL6C8zXtE5XD091nMs1S4.jpg"],
        ["The Dark Knight", 2008, 5, "https://image.tmdb.org/t/p/w200/qJ2tW6WMUDux911r6m7haRef0WH.jpg"],
        ["Pulp Fiction", 1994, 4, "https://image.tmdb.org/t/p/w200/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg"]
    ];

    moviesList.forEach(m => {
        const timeWatched = new Date(Date.now() - Math.floor(Math.random() * 100) * 86400000).toISOString();
        stmtMovies.run(m[0], m[1], m[2], timeWatched, m[3]);
    });
    stmtMovies.finalize();

    console.log("demo.sqlite created successfully.");
});

db.close();
