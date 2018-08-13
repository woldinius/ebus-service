package de.benwol.smarthome.ebus.controller.comm;

import de.benwol.smarthome.ebus.model.EBusTelegramm;

public class EBusSerialCommunicator implements EBusCommunicator {

	public EBusSerialCommunicator() {

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