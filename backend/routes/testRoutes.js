const express = require("express");

const router = express.Router();

router.post("/test", (req, res) => {
    console.log(req.body);

    res.json({
        message: "Data received successfully",
        receivedData: req.body
    });
});

module.exports = router;