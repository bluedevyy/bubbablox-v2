require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

const app = express();
const cacheFolder = path.join(__dirname, "cache"); 

if (!fs.existsSync(cacheFolder)) {
    fs.mkdirSync(cacheFolder);
}

app.get("/asset/", async(req,res) => {
    const authorizationKey = req.headers.authorizationKey;
    if(authorizationKey !== process.env.AuthorizationKey && process.env.useAuthorization) {
        return res.status(401).send("Unauthorized")
    }

    try {
        const id = req.query.id;
        if(!id) return res.status(400).send("Missing id");
        
        const filePath = path.join(cacheFolder, id);

        if (fs.existsSync(filePath)) {
            console.log(`Serving cached: ${id}`);
            return res.download(filePath, "asset");
        }

        const headers = {
            "Cookie": `.ROBLOSECURITY=${process.env.Cookie}`,
            "Accept-Encoding": "gzip,deflate,br",
            "Accept": "*/*",
            "User-Agent": "Roblox/WinInet"
        }

        const url = `https://assetdelivery.roblox.com/v1/asset/?id=${id}`;

        const response = await axios.get(url, {
            headers,
            responseType: "stream"
        });

        var writer;

        if(process.env.cacheAssets) {
            writer = fs.createWriteStream(filePath);
        }

        res.setHeader("Content-Disposition", `attachment; filename="asset"`);

        response.data.pipe(writer);
        response.data.pipe(res);

    } catch(e) {
        res.status(500).send("Error fetching asset");
    }
});

app.listen(process.env.Port, () => console.log("Started on Port " + process.env.Port));