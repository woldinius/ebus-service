package de.benwol.smarthome.ebus.controller.comm;

import java.net.PortUnreachableException;

import de.benwol.smarthome.ebus.model.EBusTelegramm;
import gnu.io.CommPort;
import gnu.io.CommPortIdentifier;
import gnu.io.SerialPort;

public class EBusSerialCommunicator implements EBusCommunicator {

	public SerialPort connect(String portName) throws Exception {
		CommPortIdentifier portIdentifier = CommPortIdentifier.getPortIdentifier(portName);

		if (portIdentifier.isCurrentlyOwned()) {
			throw new PortUnreachableException(
					"Port " + portName + " is already in use by " + portIdentifier.getCurrentOwner());
		}
		CommPort commPort = portIdentifier.open(this.getClass().getName(), 2400);

		if (commPort instanceof SerialPort) {
			SerialPort serialPort = (SerialPort) commPort;
			serialPort.setSerialPortParams(2400, SerialPort.DATABITS_8, SerialPort.STOPBITS_1, SerialPort.PARITY_NONE);
			return serialPort;
		}
		return null;
	}

	@Override
	public boolean sendTelegramm(EBusTelegramm ebusTelegramm) {
		return false;
	}

	@Override
	public boolean recievedTelegramm(EBusTelegramm ebusTelegramm) {
		return false;
	}
}