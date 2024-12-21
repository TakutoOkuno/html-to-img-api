import express from "express";
import fileUpload from 'express-fileupload';
import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';
import fs from "fs";

const app = express();
const port = 3000;
app.use(fileUpload());

app.get('/', (req, res) => {
  const message = 'Hello!';
  console.log(message);
  res.status(200).send(message);
});

app.post('/convert', async (req, res) => {
  console.log('in /convert');
  if (!req.files || Object.keys(req.files).length === 0) {
    res.status(400).send('No files were uploaded.');
  }

  const file = req?.files?.file;
  console.log('file');
  console.log(file);
  if (Array.isArray(file)) {
    res.status(400).send('Multiple files uploads are not supported.');
    return;
  } else if (typeof file === "undefined") {
    res.status(400).send('No files were uploaded.');
    return;
  }

  // 使用する一時ディレクトリ
  const tmpDir = '/tmp';
  const inputDir = `${tmpDir}/input/`;
  const outputDir = `${tmpDir}/output/`;

  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const uploadPath = `${inputDir}${file.name}`;
  file.mv(uploadPath, (err) => {
    if (err) return res.status(500).send(err);
  });

  const outputFileName = 'coverageReport.png';
  const outputImagePath = `${outputDir}${outputFileName}`;

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.goto(`file://${uploadPath}`);
    await page.screenshot({
      path: outputImagePath,
      fullPage: true,
    });

    fs.readFile(outputImagePath, (err, data) => {
      if (err) throw err;
      const fileName = encodeURIComponent(outputFileName);
      res.set({'Content-Disposition': `attachment; filename=${fileName}`});
      res.type('png');
      res.status(200).send(data);
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error occurred while processing the screenshot.');
  } finally {
    await browser.close();
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
