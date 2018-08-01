package de.benwol.smarthome.ebus.model;

import org.springframework.core.codec.ByteArrayDecoder;
import org.springframework.core.codec.ByteArrayEncoder;

import ch.qos.logback.core.encoder.ByteArrayUtil;
import static de.benwol.smarthome.ebus.model.EBusTelegrammValue.of;

public class EBusHeader {

    public static final EBusTelegrammValue HEADER_SIZE = of(0, (byte) 0x06);
    public static final EBusTelegrammValue VERSION = of(1, (byte) 0x20);
    public static final EBusTelegrammValue OBJECTSERVER_REQUEST = of(2, (byte) 0xF0, (byte) 0x80);
    public static final EBusTelegrammValue STRUCTURE = of(4, (byte) 0x04);

    public static final EBusTelegrammValue RESERVED = of(5, (byte) 0x00, (byte) 0x00, (byte) 0x00);
    public static final byte MAINSERVICE = 0x04;

    public static final byte STRUCTURE_LENGTH = 0x04;

    public EBusHeader() {

    }

    public byte[] getFrameSize() {
        byte[] frameSize = new byte[2];
        ByteArrayUtil.hexStringToByteArray("0xFFFF");//TODO dummy value
        return frameSize;
    }

public byte[] getHeaderByteArray() {
    return new byte[] {HEADER_SIZE,VERION,OBJECTSERVER_REQUEST,getFrameSize(), STRUCTURE_LENGTH, RESERVED, RESERVED, RESERVED, MAINSERVICE}
}

}