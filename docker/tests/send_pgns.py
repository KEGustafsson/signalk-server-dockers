import can
import time

bus = can.interface.Bus(
    bustype='socketcan',
    channel='vcan0',
    bitrate=250000
)

msg = can.Message(
    arbitration_id=0x1F112,
    is_extended_id=True,
    data=[0x00, 0x01, 0x02, 0x03, 0x04]
)

bus.send(msg)
time.sleep(1)
