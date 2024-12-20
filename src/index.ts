import express from "express";
import fileUpload from 'express-fileupload';
// import chrome from 'chrome-aws-lambda';
// import puppeteer from "puppeteer-core";
import puppeteer from "puppeteer";
import fs from "fs";

const app = express();
const port = 3000;
app.use(fileUpload());

app.get('/', (req, res) => {
  const message = 'Hello!';
  console.log(message);
  res.status(200).send(message)
})

app.post('/convert', async (req, res) => {
  console.log('in /convert');
  if (!req.files || Object.keys(req.files).length === 0) {
    res.status(400).send('No files were uploaded.');
  }

  const file = req?.files?.file;
  console.log('file');
  console.log(file);
  if (Array.isArray(file)) {
    res.status(400).send('Mutiple files uploads are not supported.');
    return;
  } else if (typeof file === "undefined") {
    res.status(400).send('No files were uploaded.');
    return;
  }
  console.log('__dirname');
  console.log(__dirname);
  if (!fs.existsSync(`${__dirname}/input/`)) {
    fs.mkdir(`${__dirname}/input/`, { recursive: true }, (err: NodeJS.ErrnoException | null) => {
      if (err) throw err;
    });
  }
  console.log('mkdir input');
  const uploadPath = `${__dirname}/input/${file.name}`;
  console.log('uploadPath');
  console.log(uploadPath);

  file.mv(uploadPath, (err) => {
    if (err) return res.status(500).send(err);
  });
  const outputFileName = 'coverageReport.png';
  const outputImagePath = `${__dirname}/output/${outputFileName}`;
  console.log('outputFileName');
  console.log(outputFileName);
  console.log('outputImagePath');
  console.log(outputImagePath);

  const browser = await puppeteer.launch({headless: true});
  // const browser = await puppeteer.launch({
  //   args: chrome.args,
  //   executablePath: await chrome.executablePath,
  //   headless: true
  // });
  (async () => {
    console.log('puppeteer launched');
    if (!fs.existsSync(`${__dirname}/output/`)) {
      fs.mkdir(`${__dirname}/output/`, { recursive: true }, (err: NodeJS.ErrnoException | null) => {
        if (err) throw err;
      });
    }
    console.log('mkdir output');

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

app.listen(port);

export default app;
