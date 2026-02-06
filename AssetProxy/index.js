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

app.get("/asset/", async (req, res) => {
    const authorizationKey = req.headers.authorizationkey;
    if (process.env.useAuthorization && authorizationKey !== process.env.AuthorizationKey) {
        return res.status(401).send("Unauthorized");
    }

    try {
        const id = req.query.id;
        if (!id) return res.status(400).send("Missing id");

        const filePath = path.join(cacheFolder, id);

        if (fs.existsSync(filePath)) {
            console.log(`Serving cached: ${id}`);
            return res.download(filePath, "asset");
        }

        const assetDeliveryApis = [
            "https://assetdelivery.synt2x.xyz/v1/asset",
            "https://assetdelivery.pekora.zip/v1/asset",
            "https://assetdelivery.cartii.fit/v1/asset", // we got a very fast proxy here at cartii.fit | its written in rust. :O
            "https://assetdelivery.kornet.lat/v1/asset",
            "https://assetdelivery.lureon.fit/v1/asset",
            "https://bt.zawg.ca/v1/asset",
            "https://assetdelivery.jewblox.de/v1/asset"
        ];

        const headers = {
            "Cookie": process.env.useMultiFetch ? `.ROBLOSECURITY=WeStealBandwidthfromotherrevivalsLOLZ` : `.ROBLOSECURITY=${process.env.Cookie}`,
            "Accept-Encoding": "gzip,deflate,br",
            "Accept": "*/*",
            "User-Agent": "Roblox/WinInet"
        };

        let successfulResponse = null;

        if (process.env.useMultiFetch) {
            const shuffled = assetDeliveryApis.sort(() => 0.5 - Math.random());
            
            for (const baseUrl of shuffled) {
                try {
                    const check = await axios.get(`${baseUrl}/?id=1`, { headers, timeout: 2500 });
                    if (check.status === 200) {
                        successfulResponse = await axios.get(`${baseUrl}/?id=${id}`, {
                            headers,
                            responseType: "stream",
                            timeout: 10000
                        });
                        break;
                    }
                } catch (err) {
                    continue;
                }
            }
        } else {
            const robloxUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${id}`;
            successfulResponse = await axios.get(robloxUrl, {
                headers,
                responseType: "stream",
                timeout: 10000
            });
        }

        if (!successfulResponse) {
            return res.status(502).send("No asset for u");
        }

        res.setHeader("Content-Disposition", `attachment; filename="asset"`);

        if (process.env.cacheAssets) {
            const writer = fs.createWriteStream(filePath);
            successfulResponse.data.pipe(writer);
        }

        successfulResponse.data.pipe(res);

    } catch (e) {
        console.error(e.message);
        if (!res.headersSent) {
            res.status(500).send("Error fetching asset");
        }
    }
});

app.listen(process.env.Port, () => console.log("Started on Port " + process.env.Port));