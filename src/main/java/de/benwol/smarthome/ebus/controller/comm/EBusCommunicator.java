package de.benwol.smarthome.ebus.controller.comm;

import de.benwol.smarthome.ebus.model.EBusTelegramm;

public interface EBusCommunicator {

    boolean sendTelegramm(EBusTelegramm ebusTelegramm);

    boolean recievedTelegramm(EBusTelegramm ebusTelegramm);

}