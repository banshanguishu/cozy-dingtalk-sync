@echo off
setlocal
set IMAGE_NAME=192.168.1.252:15000/cozy-dingtalk-sync
set TAG=latest
set FULL_IMAGE_NAME=%IMAGE_NAME%:%TAG%
echo Start building image: %FULL_IMAGE_NAME%
docker build -t %FULL_IMAGE_NAME% .
if %ERRORLEVEL% EQU 0 (
    echo Image build success!
    echo Start pushing image to remote repository...
    docker push %FULL_IMAGE_NAME%
    if %ERRORLEVEL% EQU 0 (
        echo Image push success!
        echo Deploy script finished.
    ) else (
        echo Image push failed, please check network or repository permission.
        exit /b 1
    )
) else (
    echo Image build failed, please check Dockerfile.
    exit /b 1
)
endlocal
