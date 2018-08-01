package de.benwol.smarthome.ebus.model;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode
public class EBusTelegrammValue implements EBusUsable {

    public static EBusTelegrammValue of(int index, int length, byte... value) {
        return new EBusTelegrammValue(index, length, value);
    }

    private byte[] value;
    private int index;
    private int length;

    public EBusTelegrammValue(int index, int length, byte... value) {
        assert (value.length <= length);
        assert (index > 0);
        setValue(value);
        setIndex(index);
        setLength(length);
    }

    @Override
    public byte[] byteArray() {
        byte[] byteArray = new byte[getLength()];
        byte[] presetValues = getValue();
        for (int i = presetValues.length; i < length; i++) {
            byteArray[i] = 0x00;
        }
        return byteArray;
    }
}