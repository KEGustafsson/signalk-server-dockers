#!/usr/bin/env sh
service dbus restart
/usr/sbin/avahi-daemon -k
/usr/sbin/avahi-daemon --no-drop-root &
service bluetooth restart
/usr/bin/pm2-docker '/usr/lib/node_modules/signalk-server/bin/signalk-server --securityenabled'


#!/usr/bin/env sh
if [ -S /run/dbus/system_bus_socket ] && dbus-send --system --dest=org.freedesktop.DBus --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames >/dev/null 2>&1; then
    echo "Using host D-Bus (socket mounted from host)"
else
    echo "Starting container D-Bus and Avahi services"
    service dbus restart
    /usr/sbin/avahi-daemon -k 2>/dev/null
    /usr/sbin/avahi-daemon --no-drop-root &
    # service bluetooth restart
fi
#/usr/bin/pm2-docker 'node --trace-deprecation /usr/lib/node_modules/signalk-server/bin/signalk-server --securityenabled'
/usr/bin/pm2-docker 'node --trace-deprecation /home/node/signalk/node_modules/signalk-server/bin/signalk-server --securityenabled'
#/usr/bin/pm2-docker 'node --trace-deprecation /home/node/signalk/node_modules/.bin/signalk-server --securityenabled'
