import express from "express";
import fileUpload from 'express-fileupload';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from "fs";
import util from "util";

const app = express();
const port = 3000;
app.use(fileUpload());

app.get('/', (req, res) => {
  const message = 'Hello!';
  console.log(message);
  res.status(200).send(message);
});

app.post('/convert', async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    console.error('No files were uploaded.');
    res.status(400).send('No files were uploaded.');
  }

  const file = req?.files?.file;
  if (Array.isArray(file)) {
    console.error('Multiple files uploads are not supported.');
    res.status(400).send('Multiple files uploads are not supported.');
    return;
  } else if (typeof file === "undefined") {
    console.error('No files were uploaded.');
    res.status(400).send('No files were uploaded.');
    return;
  }

  // 使用する一時ディレクトリを明示的に設定
  const tmpDir = '/tmp';
  const inputDir = `${tmpDir}/input/`;
  const outputDir = `${tmpDir}/output/`;

  try {
    await fs.promises.mkdir(inputDir, { recursive: true });
    await fs.promises.mkdir(outputDir, { recursive: true });

    const uploadPath = `${inputDir}${file.name}`;
    await util.promisify(file.mv)(uploadPath);

    const outputFileName = 'coverageReport.png';
    const outputImagePath = `${outputDir}${outputFileName}`;

    const executablePath = await chromium.executablePath();
    console.log('Executable Path:', executablePath);

    // Chromiumバイナリの存在を確認
    try {
      await fs.promises.access(executablePath, fs.constants.X_OK);
      console.log('Chromium executable exists and is executable');
    } catch (err) {
      console.error('Chromium executable does not exist or is not executable:', err);
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto(`file://${uploadPath}`);
    await page.screenshot({
      path: outputImagePath,
      fullPage: true,
    });

    const data = await fs.promises.readFile(outputImagePath);
    const fileName = encodeURIComponent(outputFileName);
    res.set({'Content-Disposition': `attachment; filename=${fileName}`});
    res.type('png');
    res.status(200).send(data);

    await browser.close();
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send('Error occurred while processing the screenshot.');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
