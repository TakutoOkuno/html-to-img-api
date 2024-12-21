import express from "express";
import fileUpload from 'express-fileupload';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from "fs";
import path from "path";
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
    const srcDir = path.join(__dirname, '_css');
    const cssDir = path.join(tmpDir, '_css');
    if (!await isCssFilesInTmpDir(cssDir)) {
      copyCssFiles(srcDir, cssDir);
    }

    await fs.promises.mkdir(inputDir, { recursive: true });
    await fs.promises.mkdir(outputDir, { recursive: true });

    const uploadPath = `${inputDir}${file.name}`;
    await util.promisify(file.mv)(uploadPath);

    const outputFileName = 'coverageReport.png';
    const outputImagePath = `${outputDir}${outputFileName}`;

    const executablePath = await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar');
    console.log(`Listing files in ${cssDir}...`);
    listFiles(cssDir)
    // Chromiumバイナリの存在を確認
    try {
      await fs.promises.access(executablePath, fs.constants.X_OK);
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

const copyCssFiles = async (srcDir: string, destDir: string) => {
  try {
    console.log('Starting to copy CSS files...');
    // ディレクトリが存在しない場合は作成
    await fs.promises.mkdir(destDir, { recursive: true });

    // src からファイルを読み込む
    const files = await fs.promises.readdir(srcDir);
    console.log(`Files in source directory (${srcDir}):`, files);

    // ファイルをコピー
    for (const file of files) {
      const srcFile = path.join(srcDir, file);
      const destFile = path.join(destDir, file);

      await fs.promises.copyFile(srcFile, destFile);
      console.log(`Copied ${srcFile} to ${destFile}`);
    }
    console.log('Finished copying CSS files.');
    console.log(`Listing files in ${destDir}...3`);
    listFiles(destDir)
  } catch (err) {
    console.error('Error copying CSS files: ', err)
  }
}

const isCssFilesInTmpDir = async (destDir: string) => {
  try {
    // ディレクトリが存在しない場合は作成
    await fs.promises.mkdir(destDir, { recursive: true });

    // destDir 内が空でないか確認
    const destFiles = await fs.promises.readdir(destDir);
    if (destFiles.length === 0) {
      return false;
    } else {
      return true;
    }
  } catch (err: any) { // err?.code を成立させるため any を使用する
    if (err?.code === 'ENOENT') {
      return false;
    } else {
      console.error('Error checking destination directory: ', err)
      return false;
    }
  }
}

// ファイル一覧を取得する関数
function listFiles(directory: string) {
  fs.readdir(directory, (err, files) => {
    if (err) {
      return console.error('Unable to scan directory:', err);
    }

    console.log(`Files in ${directory}:`);
    files.forEach((file) => {
      const filePath = path.join(directory, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          return console.error('Unable to retrieve file stats:', err);
        }

        console.log(`${stats.isDirectory() ? 'Dir ' : 'File'}: ${filePath}`);
      });
    });
  });
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
