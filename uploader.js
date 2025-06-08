require("dotenv").config()
const AWS = require("aws-sdk")
const fs = require("fs")
const path = require("path")
const chalk = require("chalk")

// --- CONFIGURATION ---
const CONCURRENT_UPLOADS = 50 // Number of parallel uploads

function getAWSConfig() {
  const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env
  if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.error(
      chalk.red.bold("Error: Missing AWS credentials in .env file.")
    )
    console.error(
      chalk.red(
        "Please create a .env file with AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY."
      )
    )
    process.exit(1)
  }
  return {
    region: AWS_REGION,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  }
}

// --- MAIN FUNCTION ---
async function testAWSConfiguration(bucketName) {
  console.log(chalk.blue("Running AWS Configuration Test..."))

  try {
    const config = getAWSConfig()
    AWS.config.update(config)
    const s3 = new AWS.S3({ apiVersion: "2006-03-01" })

    console.log(chalk.cyan(`Checking access to bucket: ${bucketName}...`))
    await s3.headBucket({ Bucket: bucketName }).promise()

    console.log(chalk.green.bold("\n✅ AWS Configuration Test Successful!"))
    console.log(chalk.green("   - Credentials are valid."))
    console.log(chalk.green("   - Connection to the region was successful."))
    console.log(
      chalk.green(
        `   - You have permission to access the bucket "${bucketName}".`
      )
    )
  } catch (error) {
    console.error(chalk.red.bold("\n❌ AWS Configuration Test Failed."))
    console.error(chalk.red("Please check the details below:"))

    switch (error.code) {
      case "NoSuchBucket":
        console.error(
          chalk.yellow(`   - Error: The bucket "${bucketName}" does not exist.`)
        )
        break
      case "Forbidden":
        console.error(
          chalk.yellow(
            "   - Error: Access Denied. The provided credentials do not have permission to access this bucket."
          )
        )
        console.error(
          chalk.yellow(
            "     Check the IAM user permissions in your AWS console."
          )
        )
        break
      case "InvalidAccessKeyId":
        console.error(
          chalk.yellow(
            "   - Error: The AWS Access Key ID you provided does not exist in our records."
          )
        )
        break
      case "SignatureDoesNotMatch":
        console.error(
          chalk.yellow("   - Error: The Secret Access Key is incorrect.")
        )
        console.error(
          chalk.yellow(
            "     The request signature we calculated does not match the signature you provided."
          )
        )
        break
      case "NetworkingError":
        console.error(
          chalk.yellow(
            `   - Error: Unable to connect to the AWS region "${config.region}". Check your network connection and the region name.`
          )
        )
        break
      default:
        console.error(
          chalk.yellow(`   - An unexpected error occurred: ${error.message}`)
        )
        break
    }
    console.error("\nFull error details:", error)
  }
}

async function uploadDirectory(localPath, bucketName, s3Path) {
  console.log(chalk.blue("Starting upload process..."))

  // Configure AWS SDK
  const config = getAWSConfig()
  AWS.config.update(config)
  const s3 = new AWS.S3({ apiVersion: "2006-03-01" })

  console.log(chalk.blue(`Local directory: ${localPath}`))
  console.log(chalk.blue(`S3 Bucket: ${bucketName}`))
  console.log(chalk.blue(`S3 Destination Path: ${s3Path}`))

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const duplicatedFiles = []
  const notUploadedFiles = []
  let uploadedCount = 0

  try {
    const allFiles = fs.readdirSync(localPath)
    const filesToProcess = allFiles.filter((file) => {
      const fullPath = path.join(localPath, file)
      return fs.statSync(fullPath).isFile()
    })

    const totalFiles = filesToProcess.length
    console.log(chalk.cyan(`Found ${totalFiles} files to process.`))

    let processedCount = 0

    const processFile = async (fileName) => {
      const localFilePath = path.join(localPath, fileName)
      const s3Key = path.join(s3Path, fileName).replace(/\\/g, "/") // Ensure forward slashes for S3 key

      try {
        // 1. Check if file exists in S3
        await s3.headObject({ Bucket: bucketName, Key: s3Key }).promise()
        console.log(chalk.yellow(`SKIPPED (duplicate): ${fileName}`))
        duplicatedFiles.push(fileName)
      } catch (err) {
        if (err.code === "NotFound") {
          // 2. File does not exist, so upload it
          try {
            const fileContent = fs.readFileSync(localFilePath)
            await s3
              .upload({
                Bucket: bucketName,
                Key: s3Key,
                Body: fileContent,
              })
              .promise()
            console.log(chalk.green(`UPLOADED: ${fileName}`))
            uploadedCount++
          } catch (uploadError) {
            console.error(
              chalk.red(`ERROR uploading ${fileName}:`),
              uploadError.message
            )
            notUploadedFiles.push({
              file: fileName,
              error: uploadError.message,
            })
          }
        } else {
          // Other errors with headObject
          console.error(chalk.red(`ERROR checking ${fileName}:`), err)
          notUploadedFiles.push({
            file: fileName,
            error: `Failed to check S3 status: ${err.code || err.message}`,
          })
        }
      }
      processedCount++
      console.log(`Progress: ${processedCount}/${totalFiles} files processed.`)
    }

    // Concurrency limiting queue
    const queue = []
    for (const file of filesToProcess) {
      const promise = processFile(file)
      queue.push(promise)

      if (queue.length >= CONCURRENT_UPLOADS) {
        await Promise.all(queue)
        queue.length = 0
      }
    }
    await Promise.all(queue)

    console.log(chalk.bold("\n--- Upload Process Finished ---"))
    console.log(chalk.bold(`Total files found: ${totalFiles}`))
    console.log(chalk.green.bold(`Successfully uploaded: ${uploadedCount}`))
    console.log(
      chalk.yellow.bold(`Duplicates found: ${duplicatedFiles.length}`)
    )
    console.log(chalk.red.bold(`Failed to upload: ${notUploadedFiles.length}`))

    // 3. Write report files
    if (duplicatedFiles.length > 0) {
      const duplicatedLogFile = `duplicated_${timestamp}.json`
      fs.writeFileSync(
        duplicatedLogFile,
        JSON.stringify(duplicatedFiles, null, 2)
      )
      console.log(
        chalk.yellow(`\nDuplicate file list saved to: ${duplicatedLogFile}`)
      )
    }

    if (notUploadedFiles.length > 0) {
      const notUploadedLogFile = `not_uploaded_files_${timestamp}.json`
      fs.writeFileSync(
        notUploadedLogFile,
        JSON.stringify(notUploadedFiles, null, 2)
      )
      console.log(
        chalk.red(
          `List of files that failed to upload saved to: ${notUploadedLogFile}`
        )
      )
    }
  } catch (error) {
    console.error(chalk.red("An unexpected error occurred:"), error.message)
    if (error.code === "ENOENT") {
      console.error(
        chalk.red(`Error: The local directory "${localPath}" was not found.`)
      )
    }
  }
}

// --- SCRIPT EXECUTION ---
if (require.main === module) {
  const args = process.argv.slice(2)
  const command = args[0]

  const printUsage = () => {
    console.error(chalk.red("Invalid command or arguments."))
    console.error(chalk.bold("\nUsage:"))
    console.error(chalk.cyan("  To test AWS configuration:"))
    console.error(chalk.cyan("    node uploader.js test <bucket_name>"))
    console.error(chalk.cyan("\n  To upload files:"))
    console.error(
      chalk.cyan(
        "    node uploader.js upload <local_path> <bucket_name> <s3_folder>"
      )
    )
  }

  if (command === "test") {
    if (args.length !== 2) {
      printUsage()
      process.exit(1)
    }
    const [, bucket] = args
    testAWSConfiguration(bucket).catch((err) => console.error(chalk.red(err)))
  } else if (command === "upload") {
    if (args.length !== 4) {
      printUsage()
      process.exit(1)
    }
    const [, localDirectory, bucket, s3Folder] = args
    uploadDirectory(localDirectory, bucket, s3Folder).catch((err) =>
      console.error(chalk.red(err))
    )
  } else {
    printUsage()
    process.exit(1)
  }
}
