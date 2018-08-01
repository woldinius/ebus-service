package de.benwol.smarthome.ebus.model;

import org.junit.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Is.is;
import static org.hamcrest.Null.nonNull;

public class EBusTelegrammValueTest {

    private final static byte[] TEST_VALUE = new byte[] { 0x01, 0x01 };

    @Test
    public void assertionTestEBusTelegrammValueIndex() {
        EBusTelegrammValue eBusTelegrammValue = new EBusTelegrammValueTest(TEST_VALUE, -1, TEST_VALUE.length);
        assertThat("valid EBusTelegramm expected", eBusTelegrammValue, is(nonNull()));

        try {
            new EBusTelegrammValueTest(TEST_VALUE, -1, TEST_VALUE.length);
        } catch (AssertionError assertionError) {
            assertThat("assertion error expected", assertionError, is(nonNull()));
        }
    }
}