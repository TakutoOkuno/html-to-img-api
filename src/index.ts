import express from "express";
import fileUpload from 'express-fileupload';
import puppeteer from "puppeteer";
import fs from "fs";

const app = express();
const port = 3000;
app.use(fileUpload());

app.post('/convert', async (req, res) => {
  console.log(req)
  if (!req.files || Object.keys(req.files).length === 0) {
    res.status(400).send('No files were uploaded.');
  }

  const file = req?.files?.file;
  if (Array.isArray(file)) {
    res.status(400).send('Mutiple files uploads are not supported.');
    return;
  } else if (typeof file === "undefined") {
    res.status(400).send('No files were uploaded.');
    return;
  }
  fs.mkdir(`${__dirname}/input/`, { recursive: true }, (err: NodeJS.ErrnoException | null) => {
    if (err) throw err;
  });
  const uploadPath = `${__dirname}/input/${file.name}`;
  file.mv(uploadPath, (err) => {
    if (err) return res.status(500).send(err);
  });
  const outputFileName = 'coverageReport.png';
  const outputImagePath = `${__dirname}/output/${outputFileName}`;
  
  const browser = await puppeteer.launch({headless: true});
  (async () => {
    fs.mkdir(`${__dirname}/output/`, { recursive: true }, (err: NodeJS.ErrnoException | null) => {
      if (err) throw err;
    });

    const page = await browser.newPage();
    await page.goto(`file://${uploadPath}`);

    await page.screenshot({
      path: outputImagePath,
      fullPage: true,
    });
  })().catch(err => {
    console.error(err);
    process.exit(1);
  }).finally(() => {
    if (browser) browser.close();
  })

  await fs.readFile(outputImagePath, (err, data) => {
    if (err) throw err;
    const fileName = encodeURIComponent(outputFileName)
    res.set({'Content-Disposition': `attachment; filename=${fileName}`})
    res.type('png');
    res.status(200).send(data)
  });
});

app.listen(port)
