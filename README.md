# AWS S3 Image Uploader Script

This Node.js script uploads a directory of files to an AWS S3 bucket. It is designed to be resilient and handle a large number of files efficiently.

## Features

- **Secure Credential Management**: Uses a `.env` file to keep your AWS credentials secure and out of your command-line history.
- **Configuration Testing**: A `test` command to validate AWS configuration and bucket permissions before running a large job.
- **Bulk Upload**: Uploads all files from a specified local directory.
- **Concurrency**: Processes multiple files in parallel for faster uploads.
- **Duplicate Checking**: Skips files that already exist in the S3 destination.
- **Error Handling & Reporting**: Logs any files that fail to upload and creates JSON reports.
- **Enhanced Console Output**: Uses `chalk` for clear, color-coded feedback.

## Prerequisites

1.  **Node.js**: Ensure you have Node.js installed ([nodejs.org](https://nodejs.org/)).
2.  **AWS Account**: You need an AWS account and an S3 bucket.

## Setup

1.  **Install Dependencies**: Open your terminal in the project directory and run:
    ```bash
    npm install
    ```
2.  **Configure Credentials**:
    - Create a new file named `.env` in the root of the project.
    - Add your AWS credentials and region to it, like this:
      ```
      # AWS Credentials & Bucket Information
      AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
      AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
      AWS_REGION="YOUR_BUCKET_REGION"
      ```
      _Your `.env` file is already listed in `.gitignore` to prevent it from being committed accidentally._

## How to Run

The script has two main commands: `test` and `upload`. Your AWS credentials will be loaded automatically from the `.env` file.

### 1. Test AWS Configuration

This command verifies your credentials, region, and bucket access without uploading any files.

**Usage:**

```bash
node uploader.js test <bucket_name>
```

**Example:**

```bash
node uploader.js test my-photo-archive
```

### 2. Upload Files

Once you have confirmed your configuration is correct, proceed with the upload.

**Usage:**

```bash
node uploader.js upload <local_path> <bucket_name> <s3_folder>
```

**Example:**

```bash
node uploader.js upload /Users/me/Pictures/vacation my-photo-archive travel-photos
```

## Output

- **Test Command**: Provides a clear success or failure message, helping diagnose issues.
- **Upload Command**: Provides real-time progress. When finished, it may create `duplicated_...json` and `not_uploaded_files_...json` reports.
# aws_file_uploader_in_barch_files
