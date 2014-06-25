#!/bin/bash

echo "Beginning tarring of directory"
RTCPCP_FILENAME=RTCPCP_$(date +%Y%m%d).tgz
tar -c --file=$RTCPCP_FILENAME *