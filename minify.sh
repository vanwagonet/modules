#!/usr/bin/env sh

grunt nodeunit

# save a copy of the original version
cp lib/define.js lib/define.original.js

printf "Testing define.js file size..."
MIN=`uglifyjs lib/define.js -cm 2> /dev/null`
# MIN=`java -jar ~/bin/closure.jar --compilation_level ADVANCED_OPTIMIZATIONS lib/define.js 2> /dev/null`
GZIP=`echo $MIN | gzip -c`
OSIZE=`cat lib/define.js | wc -c | sed 's/^ *//;s/ *$//'`
MINSIZE=`echo $MIN | wc -c | sed 's/^ *//;s/ *$//'`
GZIPSIZE=`echo $GZIP | wc -c | sed 's/^ *//;s/ *$//'`
printf "OK\n>> original: %s  minified: %s  gzipped: %s\n\n" $OSIZE $MINSIZE $GZIPSIZE

# make sure tests pass with minified version
echo $MIN > lib/define.js
grunt nodeunit

# if tests passed, and the file will be <1KB gzipped, keep this min.
if [ $? -eq 0 ] && [ $GZIPSIZE -lt 1000 ]; then
    echo $MIN > lib/define.min.js
else
	if [ $GZIPSIZE -lt 1000 ]; then
		echo "Unit tests did not pass with the minified code."
	else
		echo "Minified file is not <1KB gzipped."
	fi
fi

# either way put back the original file
mv -f lib/define.original.js lib/define.js

