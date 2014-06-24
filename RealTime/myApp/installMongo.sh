#!/bin/bash

MONGO_INSTALLED=`sudo service mongod status`

if [ -z "$MONGO_INSTALLED" ]
then
	echo "Did not find mongo, installing"
	#install mongodb
	cat > /etc/yum.repos.d/mongodb.repo << EOL
[mongodb]
name=MongoDB Repository
baseurl=http://downloads-distro.mongodb.org/repo/redhat/os/x86_64/
gpgcheck=0
enabled=1
EOL

	sudo yum -y install mongodb-org

	#startup mongod (make sure u have at least 3.5gb free disk space)
	sudo service mongod start
else
	echo "MONGO is already running...."
fi
